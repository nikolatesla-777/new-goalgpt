#!/bin/bash

# ====================
# DEVELOPMENT ENVIRONMENT CHECK
# ====================
# Verifies all required tools are installed for Phase 0
#

echo "🔍 GoalGPT Development Environment Check"
echo "========================================"
echo ""

ERRORS=0
WARNINGS=0

# Function to check command exists
check_command() {
    local cmd=$1
    local required=$2
    local version_cmd=$3

    if command -v "$cmd" &> /dev/null; then
        if [ -n "$version_cmd" ]; then
            version=$(eval "$version_cmd" 2>&1)
            echo "✅ $cmd: $version"
        else
            echo "✅ $cmd: installed"
        fi
    else
        if [ "$required" == "required" ]; then
            echo "❌ $cmd: NOT FOUND (REQUIRED)"
            ((ERRORS++))
        else
            echo "⚠️  $cmd: NOT FOUND (optional)"
            ((WARNINGS++))
        fi
    fi
}

echo "📦 Core Tools:"
echo "---"
check_command "node" "required" "node --version"
check_command "npm" "required" "npm --version"
check_command "git" "required" "git --version"
check_command "psql" "required" "psql --version | head -n1"

echo ""
echo "🗄️  Database Tools:"
echo "---"
check_command "pg_dump" "required" "pg_dump --version | head -n1"
check_command "pg_restore" "required" "pg_restore --version | head -n1"

echo ""
echo "📱 Mobile Development:"
echo "---"
check_command "expo" "optional" "expo --version"
check_command "eas" "optional" "eas --version"

if [[ "$OSTYPE" == "darwin"* ]]; then
    if command -v xcodebuild &> /dev/null; then
        xcode_version=$(xcodebuild -version | head -n1)
        echo "✅ Xcode: $xcode_version"
    else
        echo "⚠️  Xcode: NOT FOUND (required for iOS development)"
        ((WARNINGS++))
    fi

    if [ -d "/Applications/Android Studio.app" ]; then
        echo "✅ Android Studio: installed"
    else
        echo "⚠️  Android Studio: NOT FOUND (required for Android development)"
        ((WARNINGS++))
    fi
else
    echo "ℹ️  Skipping Xcode check (macOS only)"
    echo "ℹ️  Android Studio: manual check required"
fi

echo ""
echo "🧪 Testing Tools:"
echo "---"
check_command "artillery" "optional" "artillery version | grep -o '[0-9]*\.[0-9]*\.[0-9]*'"

echo ""
echo "🔧 Optional Tools:"
echo "---"
check_command "docker" "optional" "docker --version"
check_command "yarn" "optional" "yarn --version"

echo ""
echo "================================"

# Check Node.js version
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//')
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1)

    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo "✅ Node.js version: OK (v$NODE_VERSION >= 18)"
    else
        echo "❌ Node.js version: TOO OLD (v$NODE_VERSION < 18)"
        ((ERRORS++))
    fi
fi

echo ""
echo "📝 Summary:"
echo "  Errors: $ERRORS"
echo "  Warnings: $WARNINGS"

if [ $ERRORS -eq 0 ]; then
    echo ""
    echo "✅ Environment check passed!"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Install missing optional tools if needed"
    echo "  2. Run: npm install (in project root)"
    echo "  3. Create .env file from .env.example"
    echo "  4. Run database backup: ./scripts/backup-database.sh"
    exit 0
else
    echo ""
    echo "❌ Environment check failed!"
    echo "   Please install missing required tools."
    exit 1
fi
