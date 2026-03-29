#!/bin/bash

# Helper script to set up and test the improved day-in-life narrative generation
# Location: /home/ubuntu/repos/careerality/data/content_generation/setup_improvements.sh

set -e

REPO_ROOT="/home/ubuntu/repos/careerality"
DATA_DIR="$REPO_ROOT/data/content_generation"
SERVER_DIR="$REPO_ROOT/server"

echo "================================================"
echo "Day-in-Life Narrative Generation - Setup Helper"
echo "================================================"
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

show_step() {
    echo -e "${BLUE}→ $1${NC}"
}

show_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

show_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Step 1: Run database migration
show_step "Step 1: Running database migration..."
cd "$SERVER_DIR"
if rails db:migrate; then
    show_success "Database migration completed"
else
    show_warning "Migration may have already been applied"
fi

# Step 2: Populate O*NET tasks
show_step "Step 2: Populating O*NET tasks table..."
cd "$DATA_DIR"
if ruby populate_onet_tasks.rb; then
    show_success "Tasks populated successfully"
else
    show_warning "Check database connection and O*NET data files"
fi

echo ""
echo "================================================"
echo "Setup Complete!"
echo "================================================"
echo ""
echo -e "${BLUE}Available commands:${NC}"
echo ""
echo "1. Test narrative generation:"
echo "   ruby $DATA_DIR/test_narratives.rb [occupation_code]"
echo "   Example: ruby $DATA_DIR/test_narratives.rb 11-1011.00"
echo ""
echo "2. Generate prompts (for external LLM):"
echo "   ruby $DATA_DIR/generate_narratives.rb [output_file]"
echo ""
echo "3. Generate full narratives (with local LLM):"
echo "   ruby $DATA_DIR/generate_narratives_with_llm.rb [careers_dir] [output_file]"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo "   See: $DATA_DIR/IMPROVEMENTS_SUMMARY.md"
echo ""
