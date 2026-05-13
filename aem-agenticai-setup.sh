#!/bin/bash

# AEM Agentic AI Development Environment Setup Script
# This script checks for and installs required dependencies for AEM Edge Delivery Services development

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo -e "\n${BLUE}*************************************************${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}*************************************************${NC}\n"
}

# Temp directory for custom skills cloning (cleaned up on EXIT)
_CUSTOM_TMPDIR=""

_cleanup_tmpdir() {
    if [[ -n "${_CUSTOM_TMPDIR:-}" && -d "${_CUSTOM_TMPDIR}" ]]; then
        rm -rf "${_CUSTOM_TMPDIR}" || true
    fi
}
trap _cleanup_tmpdir EXIT

# Log to stderr (used by merge functions)
log() {
    if [[ -z "${QUIET:-}" ]]; then
        printf '%s\n' "$*" >&2
    fi
}

# Copy directory tree using rsync or tar
copy_tree() {
    local src="$1" dest="$2"
    if command -v rsync >/dev/null 2>&1; then
        rsync -a "$src/" "$dest/"
    else
        tar -C "$src" -cf - . | tar -C "$dest" -xpf -
    fi
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        print_info "Detected macOS"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        print_info "Detected Linux"
    else
        OS="unknown"
        print_warning "Unknown OS: $OSTYPE"
    fi
}

# Check if Homebrew is installed (macOS)
check_homebrew() {
    if [[ "$OS" == "macos" ]]; then
        if ! command -v brew &> /dev/null; then
            print_warning "Homebrew is not installed"
            print_info "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            
            # Add Homebrew to PATH for Apple Silicon Macs
            if [[ $(uname -m) == 'arm64' ]]; then
                echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
                eval "$(/opt/homebrew/bin/brew shellenv)"
            fi
            
            print_success "Homebrew installed successfully"
        else
            print_success "Homebrew is already installed"
        fi
    fi
}

# Check and install bash
check_bash() {
    print_header "Checking bash installation"
    
    if ! command -v bash &> /dev/null; then
        print_error "bash is not installed"
        
        if [[ "$OS" == "macos" ]]; then
            print_info "Installing bash via Homebrew..."
            brew install bash
        elif [[ "$OS" == "linux" ]]; then
            print_info "Installing bash via apt-get..."
            sudo apt-get update && sudo apt-get install -y bash
        fi
        
        print_success "bash installed successfully"
    else
        BASH_VERSION=$(bash --version | head -n1)
        print_success "bash is installed: $BASH_VERSION"
    fi
}

# Check and install git
check_git() {
    print_header "Checking git installation"
    
    if ! command -v git &> /dev/null; then
        print_error "git is not installed"
        
        if [[ "$OS" == "macos" ]]; then
            print_info "Installing git via Homebrew..."
            brew install git
        elif [[ "$OS" == "linux" ]]; then
            print_info "Installing git via apt-get..."
            sudo apt-get update && sudo apt-get install -y git
        fi
        
        print_success "git installed successfully"
    else
        GIT_VERSION=$(git --version)
        print_success "git is installed: $GIT_VERSION"
    fi
}

# Check and install GitHub CLI
check_github_cli() {
    print_header "Checking GitHub CLI installation"
    
    if ! command -v gh &> /dev/null; then
        print_error "GitHub CLI is not installed"
        
        if [[ "$OS" == "macos" ]]; then
            print_info "Installing GitHub CLI via Homebrew..."
            brew install gh
        elif [[ "$OS" == "linux" ]]; then
            print_info "Installing GitHub CLI via apt-get..."
            type -p curl >/dev/null || sudo apt install curl -y
            curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
            sudo chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
            sudo apt update
            sudo apt install gh -y
        fi
        
        print_success "GitHub CLI installed successfully"
    else
        GH_VERSION=$(gh --version | head -n1)
        print_success "GitHub CLI is installed: $GH_VERSION"
    fi
}

# Install gh-upskill extension
install_gh_upskill() {
    print_header "Installing gh-upskill extension"
    
    # Check if extension is already installed
    if gh extension list | grep -q "trieloff/gh-upskill"; then
        print_success "gh-upskill extension is already installed"
    else
        print_info "Installing gh-upskill extension..."
        gh extension install trieloff/gh-upskill
        print_success "gh-upskill extension installed successfully"
    fi
}

# Load base AGENTS.md from Adobe AEM boilerplate
load_base_agents_md() {
    print_header "Loading base AGENTS.md from Adobe AEM boilerplate"
    
    if [[ -f "AGENTS.md" ]]; then
        print_warning "AGENTS.md already exists"
        print_info "Backing up existing AGENTS.md to AGENTS.md.backup"
        cp AGENTS.md AGENTS.md.backup
    fi
    
    print_info "Downloading AGENTS.md from adobe/aem-boilerplate (main branch)..."
    
    # Download AGENTS.md from the main branch
    if curl -fsSL "https://raw.githubusercontent.com/adobe/aem-boilerplate/refs/heads/main/AGENTS.md" -o AGENTS.md; then
        print_success "Base AGENTS.md downloaded successfully"
    else
        print_error "Failed to download AGENTS.md"
        
        # Restore backup if download failed and backup exists
        if [[ -f "AGENTS.md.backup" ]]; then
            print_info "Restoring from backup..."
            mv AGENTS.md.backup AGENTS.md
        fi
        
        print_warning "You can manually download it from: https://github.com/adobe/aem-boilerplate/blob/main/AGENTS.md"
        return 1
    fi
    
    # Remove backup if download succeeded
    if [[ -f "AGENTS.md.backup" ]]; then
        rm AGENTS.md.backup
    fi
}

# Load skills from Adobe repository
load_adobe_skills() {
    print_header "Loading skills from Adobe repository" 
    print_info "Loading skills from adobe/helix-website repository..."
    
    # Run gh upskill command
    if gh upskill adobe/helix-website; then
        print_success "Skills loaded successfully from adobe/helix-website"
    else
        print_warning "Failed to load skills. You can manually run: gh upskill adobe/helix-website"
    fi
}

# --- Custom skills merge functions (inlined for self-contained bootstrap) ---

three_way_merge_file() {
    # Performs a 3-way merge using git merge-file
    # $1: current file (destination)
    # $2: incoming file (source)
    # $3: base file (common ancestor - empty if new)
    # $4: description for logging
    local current="$1"
    local incoming="$2"
    local base="$3"
    local desc="$4"
    
    local temp_dir
    temp_dir=$(mktemp -d)
    local merged="$temp_dir/merged"
    
    cp "$current" "$merged"
    
    if git merge-file -p "$merged" "$base" "$incoming" > "$temp_dir/result" 2>/dev/null; then
        if ! diff -q "$current" "$temp_dir/result" >/dev/null 2>&1; then
            cp "$temp_dir/result" "$current"
            log "    Successfully merged $desc"
            rm -rf "$temp_dir"
            return 0
        else
            log "    $desc unchanged (no differences after merge)"
            rm -rf "$temp_dir"
            return 2
        fi
    else
        if [[ ! -s "$base" ]]; then
            cp "$incoming" "$current"
            log "    Added new content to $desc"
            rm -rf "$temp_dir"
            return 0
        else
            log "    Merge conflict in $desc - using smart resolution"
            local result="$temp_dir/smart_merged"
            cat "$current" > "$result"
            
            local new_lines=0
            while IFS= read -r line; do
                [[ -z "$line" || "${#line}" -lt 3 ]] && continue
                local pattern
                pattern=$(echo "$line" | sed 's/[[:space:]]\+/ /g' | cut -c1-50)
                if ! grep -qF "$pattern" "$current" 2>/dev/null; then
                    echo "$line" >> "$result"
                    new_lines=$((new_lines + 1))
                fi
            done < "$incoming"
            
            cp "$result" "$current"
            rm -rf "$temp_dir"
            if [[ $new_lines -gt 0 ]]; then
                log "    Smart merged $desc (added $new_lines lines)"
                return 0
            else
                return 2
            fi
        fi
    fi
}

merge_text_file() {
    # $1: source file, $2: destination file, $3: file description
    local src_file="$1" dest_file="$2" file_desc="$3"
    
    local temp_dir
    temp_dir=$(mktemp -d)
    local base_file="$temp_dir/base.txt"
    
    local rel_path=""
    if git rev-parse --git-dir >/dev/null 2>&1; then
        local git_root
        git_root=$(git rev-parse --show-toplevel 2>/dev/null)
        if [[ -n "$git_root" ]]; then
            local abs_dest_file
            if [[ "$dest_file" = /* ]]; then
                abs_dest_file="$dest_file"
            else
                abs_dest_file="$(pwd)/$dest_file"
            fi
            rel_path="${abs_dest_file#$git_root/}"
        else
            rel_path=$(basename "$dest_file")
        fi
    fi
    
    if [[ -n "$rel_path" ]] && git rev-parse --git-dir >/dev/null 2>&1; then
        local remote_commit current_commit merge_base
        remote_commit=$(git rev-parse origin/agents-skills-update 2>/dev/null || echo "")
        current_commit=$(git rev-parse HEAD 2>/dev/null || echo "")
        
        if [[ -n "$remote_commit" && -n "$current_commit" ]]; then
            merge_base=$(git merge-base "$current_commit" "$remote_commit" 2>/dev/null || echo "")
            if [[ -n "$merge_base" ]]; then
                git show "$merge_base:$rel_path" > "$base_file" 2>/dev/null || touch "$base_file"
                log "    Using git base for 3-way merge of $file_desc"
            else
                touch "$base_file"
            fi
        else
            touch "$base_file"
        fi
    else
        touch "$base_file"
    fi
    
    local result
    if three_way_merge_file "$dest_file" "$src_file" "$base_file" "$file_desc"; then
        result=$?
        rm -rf "$temp_dir"
        return $result
    else
        rm -rf "$temp_dir"
        return $?
    fi
}

merge_skill_directory() {
    # $1: source skill dir, $2: destination skill dir, $3: skill name
    local src="$1" dest="$2" skill_name="$3"
    
    if [[ ! -d "$dest" ]]; then
        log "  Installing new skill: $skill_name"
        mkdir -p "$dest"
        copy_tree "$src" "$dest"
    else
        log "  Merging skill: $skill_name (3-way merge preserving local changes)"
        
        while IFS= read -r -d '' file; do
            local rel_path="${file#"$src"/}"
            local dest_file="$dest/$rel_path"
            
            if [[ -f "$dest_file" ]]; then
                local file_ext="${file##*.}"
                case "$file_ext" in
                    md|txt|json|yaml|yml|sh|js|ts|css|html|xml)
                        if ! diff -q "$file" "$dest_file" >/dev/null 2>&1; then
                            log "    3-way merging: $rel_path"
                            merge_text_file "$file" "$dest_file" "$rel_path"
                        else
                            log "    Skipping $rel_path (identical)"
                        fi
                        ;;
                    *)
                        log "    Skipping existing file: $rel_path (binary)"
                        ;;
                esac
            else
                log "    Adding new file: $rel_path"
                mkdir -p "$(dirname "$dest_file")"
                cp "$file" "$dest_file"
            fi
        done < <(find "$src" -type f -print0)
    fi
}

discover_and_merge_skills() {
    # $1: source skills directory, $2: destination skills directory
    local src_skills_dir="$1"
    local dest_skills_dir="$2"
    
    if [[ ! -d "$src_skills_dir" ]]; then
        print_warning "No skills directory found in custom repository"
        return 1
    fi
    
    local skill_count=0
    
    while IFS= read -r -d '' skill_file; do
        local skill_dir skill_name
        skill_dir=$(dirname "$skill_file")
        skill_name=$(basename "$skill_dir")
        
        merge_skill_directory "$skill_dir" "$dest_skills_dir/$skill_name" "$skill_name"
        skill_count=$((skill_count + 1))
    done < <(find "$src_skills_dir" -type f -name 'SKILL.md' -print0)
    
    if [[ $skill_count -eq 0 ]]; then
        print_warning "No SKILL.md files found in custom repository"
        return 1
    fi
    
    print_success "Merged $skill_count custom skill(s)"
    return 0
}

generate_discover_skills() {
    cat <<'SCRIPT'
#!/usr/bin/env bash
set -Eo pipefail
IFS=$'\n\t'

# Discover available skills in both project and global directories
# Usage: .agents/discover-skills

PROJECT_SKILLS_DIR=".claude/skills"
GLOBAL_SKILLS_DIR="$HOME/.claude/skills"

process_skills_directory() {
  local skills_dir="$1"
  local location_label="$2"

  if [[ ! -d "$skills_dir" ]]; then
    return 0
  fi

  local count=0
  while IFS= read -r -d '' skill_file; do
    count=$((count + 1))
  done < <(find "$skills_dir" -type f -name 'SKILL.md' -print0)

  if [[ $count -eq 0 ]]; then
    return 0
  fi

  echo "$location_label ($count skill(s)):"
  local len=${#location_label}
  if [[ $len -gt 0 ]]; then
    local underline=""
    for ((i=0; i<len; i++)); do
      underline+="="
    done
    echo "$underline"
  fi
  echo ""

  while IFS= read -r -d '' skill_file; do
    skill_dir=$(dirname "$skill_file")
    skill_name=$(basename "$skill_dir")

    if head -n 1 "$skill_file" | grep -q "^---$"; then
      frontmatter=$(awk 'BEGIN{inside=0; c=0} /^---$/ {inside=!inside; if(++c==3) exit} inside==1 {print}' "$skill_file")
      name=$(printf '%s\n' "$frontmatter" | awk -F': *' '/^name:/ {sub(/^name: */,"",$0); print substr($0, index($0,$2))}' 2>/dev/null)
      description=$(printf '%s\n' "$frontmatter" | awk -F': *' '/^description:/ {sub(/^description: */,"",$0); print substr($0, index($0,$2))}' 2>/dev/null)

      echo "Skill: ${name:-$skill_name}"
      echo "Path: $skill_file"
      if [[ -n "$description" ]]; then
        echo "Description: $description"
      fi
    else
      echo "Skill: $skill_name"
      echo "Path: $skill_file"
      echo "Description:"
      head -n 5 "$skill_file"
    fi

    echo ""
    echo "---"
    echo ""
  done < <(find "$skills_dir" -type f -name 'SKILL.md' -print0)
}

echo "Available Skills:"
echo "=================="
echo ""

process_skills_directory "$PROJECT_SKILLS_DIR" "Project Skills (.claude/skills)"
process_skills_directory "$GLOBAL_SKILLS_DIR" "Personal Skills (~/.claude/skills)"

if [[ ! -d "$PROJECT_SKILLS_DIR" && ! -d "$GLOBAL_SKILLS_DIR" ]]; then
  echo "No skills directories found."
  echo "- Project skills: $PROJECT_SKILLS_DIR"
  echo "- Personal skills: $GLOBAL_SKILLS_DIR"
fi
SCRIPT
}

merge_agents_md() {
    # $1: source AGENTS.md path
    # $2: destination AGENTS.md path (default: AGENTS.md)
    local src_agents="$1"
    local dest_agents="${2:-AGENTS.md}"
    
    if [[ ! -f "$src_agents" ]]; then
        print_warning "AGENTS.md not found in custom repository"
        return 1
    fi
    
    print_info "Performing 3-way merge on AGENTS.md sections..."
    
    if [[ ! -f "$dest_agents" ]]; then
        print_info "Creating new AGENTS.md from custom repository"
        cp "$src_agents" "$dest_agents"
        print_success "Created AGENTS.md"
        return 0
    fi
    
    local sections_merged=0
    local sections_skipped=0
    local temp_dir
    temp_dir=$(mktemp -d)
    
    local base_agents="$temp_dir/base_AGENTS.md"
    
    if git rev-parse --git-dir >/dev/null 2>&1; then
        local remote_commit
        remote_commit=$(git rev-parse origin/agents-skills-update 2>/dev/null || echo "")
        local current_commit
        current_commit=$(git rev-parse HEAD 2>/dev/null || echo "")
        
        if [[ -n "$remote_commit" && -n "$current_commit" ]]; then
            local merge_base
            merge_base=$(git merge-base "$current_commit" "$remote_commit" 2>/dev/null || echo "")
            
            if [[ -n "$merge_base" ]]; then
                git show "$merge_base:AGENTS.md" > "$base_agents" 2>/dev/null || touch "$base_agents"
                print_info "Using git merge-base for 3-way merge"
            else
                touch "$base_agents"
            fi
        else
            touch "$base_agents"
        fi
    else
        touch "$base_agents"
    fi
    
    local src_sections
    src_sections=$(grep '^## ' "$src_agents" | sed 's/^## //')
    
    if [[ -z "$src_sections" ]]; then
        print_warning "No sections (## headings) found in source AGENTS.md"
        rm -rf "$temp_dir"
        return 1
    fi
    
    print_info "Found $(echo "$src_sections" | wc -l | tr -d ' ') sections in source AGENTS.md"
    
    local dest_sections
    dest_sections=$(grep '^## ' "$dest_agents" | sed 's/^## //' || echo "")
    
    local all_sections
    all_sections=$(printf '%s\n%s' "$src_sections" "$dest_sections" | sort -u)
    
    while IFS= read -r section_name; do
        [[ -z "$section_name" ]] && continue
        
        local src_section_file="$temp_dir/src_${section_name// /_}.txt"
        awk -v section="$section_name" '
            $0 == "## " section {flag=1; print; next}
            /^## / && flag {exit}
            flag {print}
        ' "$src_agents" > "$src_section_file"
        
        local dest_section_file="$temp_dir/dest_${section_name// /_}.txt"
        awk -v section="$section_name" '
            $0 == "## " section {flag=1; print; next}
            /^## / && flag {exit}
            flag {print}
        ' "$dest_agents" > "$dest_section_file"
        
        local base_section_file="$temp_dir/base_${section_name// /_}.txt"
        if [[ -f "$base_agents" && -s "$base_agents" ]]; then
            awk -v section="$section_name" '
                $0 == "## " section {flag=1; print; next}
                /^## / && flag {exit}
                flag {print}
            ' "$base_agents" > "$base_section_file"
        else
            touch "$base_section_file"
        fi
        
        if [[ ! -s "$dest_section_file" && -s "$src_section_file" ]]; then
            print_info "  New section: '$section_name' - adding to AGENTS.md"
            
            local temp_file
            temp_file=$(mktemp)
            local inserted=0
            
            while IFS= read -r line || [[ -n "$line" ]]; do
                if [[ "$inserted" -eq 0 && "$line" =~ ^\<\!-- ]]; then
                    printf '\n## %s\n' "$section_name" >> "$temp_file"
                    tail -n +2 "$src_section_file" >> "$temp_file"
                    echo "" >> "$temp_file"
                    inserted=1
                fi
                echo "$line" >> "$temp_file"
            done < "$dest_agents"
            
            if [[ "$inserted" -eq 0 ]]; then
                {
                    printf '\n## %s\n' "$section_name"
                    tail -n +2 "$src_section_file"
                } >> "$temp_file"
            fi
            
            mv "$temp_file" "$dest_agents"
            sections_merged=$((sections_merged + 1))
            
        elif [[ -s "$dest_section_file" && ! -s "$src_section_file" ]]; then
            log "  Keeping local section: '$section_name' (removed in source)"
            sections_skipped=$((sections_skipped + 1))
            
        elif [[ -s "$dest_section_file" && -s "$src_section_file" ]]; then
            if ! diff -q "$src_section_file" "$dest_section_file" >/dev/null 2>&1; then
                print_info "  3-way merging section: '$section_name'"
                
                local merged_section="$temp_dir/merged_${section_name// /_}.txt"
                cp "$dest_section_file" "$merged_section"
                
                if three_way_merge_file "$merged_section" "$src_section_file" "$base_section_file" "$section_name"; then
                    local temp_file
                    temp_file=$(mktemp)
                    
                    awk -v section="$section_name" -v merged_file="$merged_section" '
                        BEGIN {skip=0; replaced=0}
                        $0 == "## " section {
                            while ((getline line < merged_file) > 0) print line
                            close(merged_file)
                            skip=1
                            replaced=1
                            next
                        }
                        /^## / && skip {skip=0}
                        !skip {print}
                    ' "$dest_agents" > "$temp_file"
                    
                    mv "$temp_file" "$dest_agents"
                    print_success "  Merged section: '$section_name'"
                    sections_merged=$((sections_merged + 1))
                else
                    log "  Skipping section: '$section_name' (no changes after merge)"
                    sections_skipped=$((sections_skipped + 1))
                fi
            else
                log "  Skipping section: '$section_name' (identical)"
                sections_skipped=$((sections_skipped + 1))
            fi
        fi
        
    done <<< "$all_sections"
    
    rm -rf "$temp_dir"
    
    if [[ $sections_merged -eq 0 ]]; then
        print_info "No sections needed updating (all are identical)"
        return 0
    fi
    
    print_success "3-way merged $sections_merged section(s), skipped $sections_skipped section(s)"
    return 0
}

# --- End custom skills merge functions ---

# Load custom skills from a GitHub repository (self-contained, no external scripts needed)
load_custom_skills() {
    print_header "Loading custom skills"
    
    local custom_repo="${CUSTOM_SKILLS_REPO:-moarora1/agenticai-development}"
    local custom_branch="${CUSTOM_SKILLS_BRANCH:-agents-skills-update}"
    local custom_skills_path="${CUSTOM_SKILLS_PATH:-.claude/skills}"
    local custom_dest_dir="${CUSTOM_SKILLS_DEST:-.claude/skills}"
    
    print_info "Repository: $custom_repo (branch: $custom_branch)"
    
    # Verify required commands
    if ! command -v gh &> /dev/null; then
        print_warning "GitHub CLI (gh) not available. Skipping custom skills."
        return 1
    fi
    if ! command -v git &> /dev/null; then
        print_warning "git not available. Skipping custom skills."
        return 1
    fi
    
    # Create temporary directory
    _CUSTOM_TMPDIR=$(mktemp -d)
    local clone_dir="$_CUSTOM_TMPDIR/custom-repo"
    
    # Clone the repository
    print_info "Cloning $custom_repo (branch: $custom_branch)..."
    if ! gh repo clone "$custom_repo" "$clone_dir" -- -b "$custom_branch" >/dev/null 2>&1; then
        print_warning "Failed to clone $custom_repo. Skipping custom skills."
        print_info "Make sure you have access to $custom_repo and branch $custom_branch exists."
        rm -rf "${_CUSTOM_TMPDIR}" || true
        _CUSTOM_TMPDIR=""
        return 1
    fi
    
    print_success "Repository cloned successfully"
    
    # Ensure destination directory exists
    mkdir -p "$custom_dest_dir"
    
    # Merge skills
    local src_skills_dir="$clone_dir/$custom_skills_path"
    print_info "Merging custom skills..."
    
    if discover_and_merge_skills "$src_skills_dir" "$custom_dest_dir"; then
        # Update .agents/discover-skills script
        print_info "Updating .agents/discover-skills script..."
        mkdir -p .agents
        local discover=".agents/discover-skills"
        generate_discover_skills >"$discover"
        chmod +x "$discover"
        print_success "Updated discover-skills script"
        
        # Merge AGENTS.md file
        local src_agents="$clone_dir/AGENTS.md"
        merge_agents_md "$src_agents" "AGENTS.md"
        
        print_success "Custom skills loaded and merged successfully!"
    else
        print_warning "No custom skills were loaded"
    fi
    
    # Cleanup temp directory
    rm -rf "${_CUSTOM_TMPDIR}" || true
    _CUSTOM_TMPDIR=""
}

# Check and install nvm
check_nvm() {
    print_header "Checking nvm (Node Version Manager) installation"
    
    # Check if nvm is already installed
    if [ -s "$HOME/.nvm/nvm.sh" ]; then
        print_success "nvm is already installed"
        # Load nvm
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    else
        print_info "Installing nvm..."
        
        # Install nvm
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
        
        # Load nvm
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        # Add nvm to shell profile
        if [[ "$SHELL" == *"zsh"* ]]; then
            PROFILE_FILE="$HOME/.zshrc"
        else
            PROFILE_FILE="$HOME/.bashrc"
        fi
        
        if ! grep -q 'NVM_DIR' "$PROFILE_FILE" 2>/dev/null; then
            cat >> "$PROFILE_FILE" << 'EOF'

# nvm configuration
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"  # This loads nvm bash_completion
EOF
            print_info "Added nvm to $PROFILE_FILE"
        fi
        
        print_success "nvm installed successfully"
    fi
    
    # Verify nvm is loaded
    if command -v nvm &> /dev/null; then
        NVM_VERSION=$(nvm --version)
        print_success "nvm version: $NVM_VERSION"
    else
        print_warning "nvm installed but not loaded. Please restart your terminal or run: source ~/.nvm/nvm.sh"
    fi
}

# Check and install Node.js using nvm
check_nodejs() {
    print_header "Checking Node.js installation"
    
    REQUIRED_NODE_MAJOR="22"
    
    # Ensure nvm is loaded
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        print_info "Installing Node.js $REQUIRED_NODE_MAJOR using nvm..."
        
        nvm install 22
        nvm use 22
        nvm alias default 22
        
        print_success "Node.js installed successfully"
    else
        NODE_VERSION=$(node --version | sed 's/v//')
        NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)
        
        print_info "Found Node.js version: v$NODE_VERSION"
        
        if [ "$NODE_MAJOR_VERSION" -ne "$REQUIRED_NODE_MAJOR" ]; then
            print_warning "Node.js version must be $REQUIRED_NODE_MAJOR.x.x. Found: v$NODE_VERSION"
            print_info "Installing Node.js $REQUIRED_NODE_MAJOR using nvm..."
            
            # Install Node.js 22 using nvm
            nvm install 22
            nvm use 22
            nvm alias default 22
            
            # Verify installation
            NODE_VERSION=$(node --version | sed 's/v//')
            print_success "Node.js switched to v$NODE_VERSION"
        else
            print_success "Node.js version is correct: v$NODE_VERSION"
        fi
    fi
}

# Check and install npm
check_npm() {
    print_header "Checking npm installation"
    
    REQUIRED_NPM_MAJOR="9"
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        print_info "npm should have been installed with Node.js. Reinstalling Node.js..."
        check_nodejs
    else
        NPM_VERSION=$(npm --version)
        NPM_MAJOR_VERSION=$(echo $NPM_VERSION | cut -d. -f1)
        
        print_info "Found npm version: $NPM_VERSION"
        
        if [ "$NPM_MAJOR_VERSION" -lt "$REQUIRED_NPM_MAJOR" ]; then
            print_warning "npm version must be $REQUIRED_NPM_MAJOR.0.0 or higher. Found: $NPM_VERSION"
            print_info "Upgrading npm..."
            npm install -g npm@latest
            
            # Verify upgrade
            NPM_VERSION=$(npm --version)
            print_success "npm upgraded to $NPM_VERSION"
        else
            print_success "npm version is sufficient: $NPM_VERSION"
        fi
    fi
}

# Install AEM CLI
install_aem_cli() {
    print_header "Installing AEM CLI"
    
    if command -v aem &> /dev/null; then
        print_success "AEM CLI is already installed"
        aem --version
    else
        print_info "Installing @adobe/aem-cli globally..."
        npm install -g @adobe/aem-cli
        print_success "AEM CLI installed successfully"
    fi
}

# Install project dependencies
install_project_dependencies() {
    print_header "Installing project dependencies"
    
    if [ -f "package.json" ]; then
        print_info "Installing npm dependencies..."
        npm install
        print_success "Project dependencies installed successfully"
    else
        print_warning "No package.json found in current directory"
    fi
}

# Verify installation
verify_installation() {
    print_header "Verifying installation"
    
    echo ""
    print_info "Installation Summary:"
    echo "----------------------------------------"
    
    if command -v bash &> /dev/null; then
        echo "bash:    $(bash --version | head -n1)"
    fi
    
    if command -v git &> /dev/null; then
        echo "git:     $(git --version)"
    fi
    
    if command -v gh &> /dev/null; then
        echo "GitHub CLI: $(gh --version | head -n1)"
    fi
    
    # Load nvm for verification
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    if command -v nvm &> /dev/null; then
        echo "nvm:     $(nvm --version)"
    fi
    
    if command -v node &> /dev/null; then
        echo "Node.js: $(node --version)"
    fi
    
    if command -v npm &> /dev/null; then
        echo "npm:     $(npm --version)"
    fi
    
    if command -v aem &> /dev/null; then
        echo "AEM CLI: $(aem --version 2>&1 | head -n1)"
    fi
    
    echo "----------------------------------------"
    echo ""
    print_success "All components verified successfully!"
}

# Show usage information
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "AEM Agentic AI Development Environment Setup Script."
    echo "Checks for and installs required dependencies for AEM Edge Delivery Services development."
    echo ""
    echo "OPTIONS:"
    echo "  -r, --repo REPO          Custom skills GitHub repository (format: owner/repo)"
    echo "                           Default: moarora1/agenticai-development"
    echo "  -b, --branch BRANCH      Custom skills branch name"
    echo "                           Default: agents-skills-update"
    echo "  -s, --skills-path PATH   Relative path to skills directory in repo"
    echo "                           Default: .claude/skills"
    echo "  -d, --dest-dir DIR       Destination directory for merged skills"
    echo "                           Default: .claude/skills"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "EXAMPLES:"
    echo "  # Use default settings"
    echo "  $0"
    echo ""
    echo "  # Use custom repository and branch"
    echo "  $0 --repo myorg/custom-skills --branch main"
    echo ""
    echo "  # Specify all options"
    echo "  $0 -r myorg/skills -b production -s skills -d .custom/skills"
    echo ""
    exit 0
}

# Main execution
main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -r|--repo)
                export CUSTOM_SKILLS_REPO="$2"
                shift 2
                ;;
            -b|--branch)
                export CUSTOM_SKILLS_BRANCH="$2"
                shift 2
                ;;
            -s|--skills-path)
                export CUSTOM_SKILLS_PATH="$2"
                shift 2
                ;;
            -d|--dest-dir)
                export CUSTOM_SKILLS_DEST="$2"
                shift 2
                ;;
            -h|--help)
                usage
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    local custom_repo="${CUSTOM_SKILLS_REPO:-moarora1/agenticai-development}"
    local custom_branch="${CUSTOM_SKILLS_BRANCH:-agents-skills-update}"

    print_header "AEM Agentic AI Development Environment Setup"
    
    echo "This script will check for and install required dependencies:"
    echo "  - bash (latest)"
    echo "  - git (latest)"
    echo "  - GitHub CLI (latest)"
    echo "  - nvm (Node Version Manager)"
    echo "  - Node.js (22.x.x via nvm)"
    echo "  - npm (9.0.0 or higher)"
    echo "  - AEM CLI (latest)"
    echo "  - Base AGENTS.md (from adobe/aem-boilerplate)"
    echo "  - gh-upskill extension"
    echo "  - Adobe skills (from adobe/helix-website)"
    echo "  - Custom skills (from $custom_repo, branch: $custom_branch)"
    echo ""
    
    # Detect operating system
    detect_os
    
    # Check/install Homebrew on macOS
    if [[ "$OS" == "macos" ]]; then
        check_homebrew
    fi
    
    # Check and install required software
    check_bash
    check_git
    check_github_cli
    check_nvm
    check_nodejs
    check_npm
    
    # Load base AGENTS.md from Adobe AEM boilerplate
    load_base_agents_md
    
    # Install GitHub CLI extensions
    install_gh_upskill
    
    # Load skills from Adobe repository
    load_adobe_skills
    
    # Load custom skills (merges with Adobe skills)
    load_custom_skills
    
    # Install AEM CLI
    install_aem_cli
    
    # Install project dependencies if package.json exists
    install_project_dependencies
    
    # Verify all installations
    verify_installation
    
    print_header "Setup Complete!"
    print_success "Your AEM Agentic AI development environment is ready!"
    echo ""
    print_info "Next steps:"
    echo "  1. Review loaded skills in .claude/skills/ directory"
    echo "  2. Start the development server: aem up"
    echo "  3. Open http://localhost:3000 in your browser"
    echo "  4. Start developing your AEM Edge Delivery blocks!"
    echo ""
    print_info "Additional commands:"
    echo "  - Reload Adobe skills: gh upskill adobe/helix-website"
    echo "  - Reload custom skills: ./load-custom-skills.sh"
    echo "  - List skills: ls .claude/skills/"
    echo "  - Discover skills: ./.agents/discover-skills"
    echo ""
}

# Run main function
main "$@"
