# Career Narrative Generation Workflow

## Overview

This guide documents the 2-step workflow for generating day-in-life narratives for career profiles using O*NET data and LLM generation.

## Architecture

The narrative generation process follows a **separation of concerns** pattern:

1. **Prompt Generation** (`generate_narratives.rb`) - Strategy Pattern
   - Queries database for occupation data
   - Loads top 7 most important O*NET tasks per occupation
   - Creates structured prompts with occupation descriptions and task information
   - Outputs prompts to JSON file (portable, reusable, version-controllable)

2. **LLM Generation** (`generate_narratives_with_llm.rb`) - Consumer Pattern
   - Loads pre-generated prompts from JSON file
   - Calls LLM for each prompt independently
   - Generates summary and full narrative content
   - Outputs results to JSON file

## Workflow Steps

### Step 1: Generate Prompts

```bash
cd /home/ubuntu/repos/careerality
ruby data/content_generation/generate_narratives.rb [output_file] [occupation_codes]
```

**Parameters:**
- `output_file` (optional): Path to save prompts JSON. Defaults to `narrative_prompts.json`
- `occupation_codes` (optional): Comma-separated list of codes to generate. If omitted, generates for all occupations in database.

**Example:**
```bash
# Generate for all occupations
ruby data/content_generation/generate_narratives.rb

# Generate for specific occupations only
ruby data/content_generation/generate_narratives.rb narrative_prompts.json "111011,111000,121011"

# Save to custom path
ruby data/content_generation/generate_narratives.rb /tmp/my_prompts.json
```

**Output Format:**
```json
{
  "111011": {
    "occupation_name": "Chief Executives",
    "summary_prompt": "Write a brief 1-2 sentence summary...",
    "full_prompt": "Write a detailed \"day in the life\" narrative...",
    "video_url": null
  },
  "111000": {
    "occupation_name": "Top Executives",
    ...
  }
}
```

**Key Features:**
- Occupation names are singularized ("Chief Executives" in prompts)
- Top 7 tasks by importance score included in prompts
- Canonical O*NET occupation description included as grounding signal
- Prompts are human-readable and portable

### Step 2: Generate Narratives with LLM

```bash
ruby data/content_generation/generate_narratives_with_llm.rb [prompts_file] [output_file] [model] [uri]
```

**Parameters:**
- `prompts_file` (optional): Path to prompts JSON from Step 1. Defaults to `narrative_prompts.json`
- `output_file` (optional): Path to save narratives JSON. Defaults to `generated_narratives.json`
- `model` (optional): LLM model name. Defaults to `llama3.2`
- `uri` (optional): LLM service URI. Defaults to `http://localhost:11434`

**Example:**
```bash
# Use default locations and model
ruby data/content_generation/generate_narratives_with_llm.rb

# Use custom paths
ruby data/content_generation/generate_narratives_with_llm.rb narrative_prompts.json narratives_output.json

# Use different LLM model/URI
ruby data/content_generation/generate_narratives_with_llm.rb narrative_prompts.json narratives_output.json "mistral" "http://10.0.0.1:11434"
```

**Output Format:**
```json
{
  "111011": {
    "occupation_name": "Chief Executives",
    "day_in_life_summary": "A Chief Executive typically starts their day reviewing strategic...",
    "full_narrative": "As a Chief Executive Officer, you would navigate a complex landscape...",
    "video_url": null
  }
}
```

**Error Handling:**
- If prompts file is missing: Skips and logs warning
- If `occupation_name` is missing: Falls back to occupation code
- If LLM request fails: Records error message in narrative output

## Database Requirements

The workflow requires the following database tables:

### `career_profiles` Table
- Stores occupation data keyed by code (format: `111011`)
- Contains: `onet_code`, `onet_title`, `onet_description`, etc.
- 1,082 occupations currently populated

### `onet_tasks` Table
- Stores task data for each occupation
- Contains: `occupation_code`, `task_statement`, `importance`, `frequency`
- 15,136 tasks total
- Uses importance score to rank tasks (1.0-4.95 scale)
- Filtered to top 7 by importance before prompting

## Shared Module: `narrative_generation.rb`

Provides common functionality used by both scripts:

### Database Functions
- `establish_connection()` - Connect to database
- `load_occupation_data(code)` - Load occupation by code
- `load_all_occupation_codes()` - Get all occupation codes from DB

### Formatting Functions
- `singularize_occupation(name)` - Convert plural to singular
- `format_task_list(tasks, separator, limit)` - Format tasks for prompts
- `format_skill_list(skills)` - Format skills inline
- `format_skill_list_multiline(skills, mark)` - Format skills with bullet points

## Quality Improvements

### Task Filtering
- **Before**: All tasks passed to LLM (potential for weird/irrelevant tasks)
- **After**: Top 7 tasks by O*NET importance score (better signal-to-noise ratio)

### Grounding Signal
- **Before**: No canonical reference
- **After**: Prompt includes O*NET occupation description (prevents LLM hallucination)

### Singularization
- **Before**: Career names might be plural in prompts
- **After**: Singular form ("Chief Executive" not "Chief Executives")

### Code Reusability
- **Before**: Duplicated DB config, connection, data loading across scripts
- **After**: Shared module (`narrative_generation.rb`) with 45% code reduction

## Testing

### Quick Test (2 occupations)
```bash
ruby data/content_generation/generate_narratives.rb test_prompts.json "111011,111000"
```

### Full Test (all occupations)
```bash
ruby data/content_generation/generate_narratives.rb narrative_prompts.json
```

### Verify Prompts File
```bash
ruby -rjson -e "
data = JSON.parse(File.read('narrative_prompts.json'))
puts \"Total prompts: #{data.length}\"
data.first(3).each { |code, info| puts \"#{code}: #{info['occupation_name']}\" }
"
```

## Troubleshooting

### Issue: Database connection failed
- Verify database is running
- Check credentials in `narrative_generation.rb` (DB_CONFIG)

### Issue: Prompts file not found
- Verify output path from Step 1 and input path for Step 2 match
- Default location: `/home/ubuntu/repos/careerality/data/content_generation/narrative_prompts.json`

### Issue: LLM service not responding
- Verify Ollama is running: `curl http://localhost:11434/api/tags`
- Check model is installed: `ollama list`
- Verify URI and port are correct

### Issue: Malformed JSON output
- Check for non-UTF8 characters in database
- Verify `JSON.pretty_generate()` is used for formatting

## Performance Characteristics

- **Prompt Generation**: ~2-3 seconds for all 1,082 occupations
- **LLM Generation**: Depends on model and hardware (1-10s per occupation with local Ollama)
- **Prompts File Size**: ~2.1 MB (1,082 occupations)
- **Narratives File Size**: ~5-15 MB (depending on LLM output length)

## File Locations

```
/home/ubuntu/repos/careerality/data/content_generation/
├── narrative_generation.rb              # Shared module (105 lines)
├── generate_narratives.rb               # Step 1: Prompt generation (95 lines)
├── generate_narratives_with_llm.rb      # Step 2: LLM generation (84 lines)
├── narrative_prompts.json               # Output of Step 1 / Input to Step 2
├── generated_narratives.json            # Output of Step 2
└── test_prompts.json                    # Test output (optional)
```

## Next Steps / Future Enhancements

1. **Parallel Processing**: Process multiple occupations concurrently for LLM step
2. **Caching**: Cache LLM responses to avoid regeneration
3. **Validation**: Add output validation (check narrative quality)
4. **Metrics**: Track generation success rates and performance
5. **Integration**: Integrate output into main application database

## Contact / Questions

For issues or questions about this workflow, refer to:
- Database schema: `/server/db/migrate/20260328192409_create_onet_tasks.rb`
- Shared module docs: `narrative_generation.rb` (well-commented)
- Previous implementation summary: See git history
