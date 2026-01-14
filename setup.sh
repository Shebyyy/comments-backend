#!/bin/bash

# AnymeX Comments Backend Setup Script
echo "🚀 Setting up AnymeX Comments Backend..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "📝 Creating .env.local from template..."
    cp .env.local.example .env.local
    echo "⚠️  Please edit .env.local with your Vercel Postgres credentials!"
    echo "   You'll need to get these from your Vercel dashboard."
fi

# Create GitHub repository if not exists
if ! git remote get-url origin > /dev/null 2>&1; then
    echo "🔧 Setting up Git repository..."
    git init
    git add .
    git commit -m "Initial commit: AnymeX Comments Backend"
    
    echo "📋 Next steps:"
    echo "1. Create a new repository on GitHub: https://github.com/new"
    echo "2. Run: git remote add origin <your-repo-url>"
    echo "3. Run: git push -u origin main"
    echo ""
    echo "🔗 After pushing to GitHub:"
    echo "1. Import your repository to Vercel: https://vercel.com/new"
    echo "2. Connect your Vercel Postgres database"
    echo "3. Add environment variables in Vercel dashboard"
    echo "4. Deploy! 🎉"
else
    echo "✅ Git repository already exists"
    echo "🔄 To deploy changes:"
    echo "1. git add ."
    echo "2. git commit -m 'Your changes'"
    echo "3. git push origin main"
fi

echo ""
echo "🛠️  Manual Setup Required:"
echo "========================"
echo "1. 📊 Vercel Postgres Database:"
echo "   - Go to Vercel dashboard → Storage → Create Database"
echo "   - Choose Postgres → Connect to your project"
echo "   - Copy the connection strings to .env.local"
echo ""
echo "2. 🔐 Vercel Environment Variables:"
echo "   - POSTGRES_URL"
echo "   - POSTGRES_PRISMA_URL" 
echo "   - POSTGRES_URL_NON_POOLING"
echo "   - ADMIN_ANILIST_IDS (optional)"
echo "   - MOD_ANILIST_IDS (optional)"
echo ""
echo "3. 🗄️  Database Migration:"
echo "   - After deployment, run: node setup.js"
echo "   - Or the migration will run automatically on first deploy"
echo ""
echo "📚 For detailed instructions, see README.md"