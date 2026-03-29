# frozen_string_literal: true

require_relative 'narrative_generation'
require_relative 'generate_narratives'

# Test with a sample occupation code
# You can find valid codes by querying: SELECT occupation_code FROM career_profiles LIMIT 5;
test_code = ARGV[0] || '11-1011.00' # CEO

generator = GenerateNarratives.new

puts "=" * 60
puts "Testing Day in Life Narrative Generation"
puts "=" * 60

occupation_data = NarrativeGeneration.load_occupation_data(test_code)

if occupation_data.nil?
  puts "Error: Occupation #{test_code} not found in database"
  puts "Try running with a valid occupation code as argument"
  exit 1
end

occupation_name = occupation_data['OnetTitle'] || test_code
singular_name = NarrativeGeneration.singularize_occupation(occupation_name)

puts "\nOccupation: #{occupation_name}"
puts "Singular: #{singular_name}"
puts "Code: #{test_code}"
puts "\nOccupation Description:"
puts "  #{occupation_data['OnetDescription']}"

puts "\n" + "=" * 60
puts "Tasks (filtered by importance):"
puts "=" * 60
occupation_data['Tasks'].each_with_index do |task, idx|
  importance = task.is_a?(Hash) ? task['importance'] : 'N/A'
  frequency = task.is_a?(Hash) ? task['frequency'] : 'N/A'
  description = task.is_a?(Hash) ? task['task_description'] : task
  puts "\n#{idx + 1}. (Importance: #{importance}, Frequency: #{frequency})"
  puts "   #{description}"
end

puts "\n" + "=" * 60
puts "Generated Day in Life Prompt:"
puts "=" * 60
summary_prompt = generator.generate_day_in_life(occupation_data, occupation_name)
puts summary_prompt

puts "\n" + "=" * 60
puts "Generated Full Narrative Prompt:"
puts "=" * 60
full_prompt = generator.generate_full_narrative(occupation_data, occupation_name)
puts full_prompt

puts "\n" + "=" * 60
puts "Test Complete!"
puts "=" * 60
