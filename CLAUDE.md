# Claude Code Auto-Execute Configuration

## Auto-Execute Permissions

Claude can automatically execute these commands without asking for permission:

### ✅ Development & Testing
- `npm run build*` - Frontend build processes
- `npm run test*` - JavaScript/TypeScript tests  
- `npm run dev*` - Development server startup
- `python -m pytest*` - Python backend tests
- `pytest*` - Python test execution
- `python -m unittest*` - Python unit tests

### ✅ Package Management  
- `npm install*` - Node.js package installation
- `npm ci*` - Clean install from package-lock.json
- `pip install*` - Python package installation
- `pip install -r requirements.txt` - Python dependencies

### ✅ Git Operations
- `git add *.tsx *.ts *.py *.js *.json *.md` - Add code files only
- `git status` - Check repository status
- `git diff` - Show changes
- `git log --oneline -10` - Recent commit history
- `git branch` - List branches

### ✅ Docker Operations (already enabled)
- `docker-compose restart*` - Service restart
- `docker-compose up -d*` - Start services in background  
- `docker-compose down*` - Stop services
- `docker-compose logs*` - View service logs
- `docker-compose ps` - Check service status

### ✅ Health Checks & Monitoring
- `curl -s http://localhost:*` - Local service health checks
- `curl -s http://127.0.0.1:*` - Local API testing
- `ping -c 3 localhost` - Network connectivity test
- `ps aux | grep python` - Check Python processes
- `ps aux | grep node` - Check Node.js processes

### ✅ File Operations
- `mkdir -p uploads/*` - Create upload directories  
- `mkdir -p logs/*` - Create log directories
- `cp templates/* output/*` - Template file copying
- `ls -la logs/` - Check log files
- `ls -la uploads/` - Check uploaded files
- `find . -name "*.log" -mtime -1` - Find recent log files

### ✅ System Information
- `df -h` - Disk space usage
- `free -h` - Memory usage
- `uptime` - System uptime
- `whoami` - Current user
- `pwd` - Current directory

### ✅ Environment & Configuration
- `cat .env.example` - View environment template
- `echo $NODE_ENV` - Check Node environment
- `echo $PYTHON_PATH` - Check Python path
- `which python` - Python executable location
- `which node` - Node.js executable location
- `which npm` - NPM executable location

## ⚠️ Commands that REQUIRE Permission

### Database Operations
- `python manage.py migrate` - Database migrations
- `DROP TABLE *` - Table deletion
- `DELETE FROM *` - Data deletion
- `psql -c *` - Direct PostgreSQL commands

### Production Operations  
- `git push origin main` - Production deployment
- `git push origin master` - Production deployment
- `docker build --platform linux/amd64` - Production builds
- `kubectl apply` - Kubernetes deployments

### System-Level Operations
- `sudo *` - Administrative commands
- `rm -rf *` - Recursive file deletion
- `chmod 777 *` - Permission changes
- `chown *` - Ownership changes

### External API Calls (Cost-Sensitive)
- `curl -X POST https://api.openai.com/*` - OpenAI API calls
- `curl -X POST https://api.anthropic.com/*` - Anthropic API calls
- External webhook calls to production systems

## 🚀 Figure-MCP Specific Auto-Execute

### Document Processing
- `python -c "import app.services.*"` - Service imports and testing
- `ls -la figure-backend/data/uploads/` - Check uploaded documents
- `ls -la figure-backend/data/template_files/` - Check generated templates
- `cat figure-backend/logs/api.log | tail -50` - Recent API logs

### Development Workflow
- `docker-compose restart figure-backend-office` - Frontend restart
- `docker-compose restart figure-backend` - Backend restart  
- `docker-compose restart chroma` - Vector DB restart
- `curl -s http://localhost:3001/health` - Frontend health check
- `curl -s http://localhost:8001/health` - Backend health check
- `curl -s http://localhost:8000/api/v1/heartbeat` - ChromaDB health check

### Code Analysis & Testing
- `python -m pytest tests/test_services/ -v` - Service tests
- `python -m pytest tests/test_api/ -v` - API tests
- `npm run test:unit` - Frontend unit tests
- `npm run build && npm run start` - Build and start

## 📝 Usage Examples

### Automatic Development Workflow:
```
User: "Fix the upload bug and restart services"
Claude: [Automatically executes]
1. Edit code files
2. npm run build
3. docker-compose restart figure-backend-office
4. curl -s http://localhost:3001/health
```

### Automatic Testing & Deployment:
```
User: "Run all tests and check if everything works"
Claude: [Automatically executes]  
1. python -m pytest tests/ -v
2. npm run test
3. docker-compose ps
4. curl -s http://localhost:8001/health
```

## 🔒 Security Notes

- Only code files (*.ts, *.tsx, *.py, *.js) are auto-added to git
- No production deployments without explicit permission
- No database modifications without explicit permission  
- No system-level changes without explicit permission
- All auto-executed commands are logged

---
*Last updated: 2025-08-07*
*This configuration enables Claude to work more efficiently while maintaining security.*