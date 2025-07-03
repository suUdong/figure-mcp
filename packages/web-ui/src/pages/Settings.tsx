import { useState } from 'react'
import { 
  Save, 
  Database, 
  Server, 
  Shield, 
  Bell, 
  Palette,
  Key,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react'
import { motion } from 'framer-motion'

const settingsSections = [
  { id: 'general', name: '일반 설정', icon: Server },
  { id: 'database', name: '데이터베이스', icon: Database },
  { id: 'jira', name: 'Jira 연동', icon: ExternalLink },
  { id: 'security', name: '보안', icon: Shield },
  { id: 'notifications', name: '알림', icon: Bell },
  { id: 'appearance', name: '화면 설정', icon: Palette },
]

export default function Settings() {
  const [activeSection, setActiveSection] = useState('general')
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [settings, setSettings] = useState({
    // 일반 설정
    systemName: 'Figure-MCP',
    systemDescription: '개발 표준 기반 자동 산출물 생성 시스템',
    maxFileSize: '50',
    allowedFileTypes: ['pdf', 'docx', 'xlsx', 'md'],
    
    // 데이터베이스
    dbHost: 'localhost',
    dbPort: '5432',
    dbName: 'figure_mcp',
    dbUser: 'postgres',
    dbPassword: 'password123',
    
    // Jira 연동
    jiraUrl: 'https://your-company.atlassian.net',
    jiraUsername: 'admin@company.com',
    jiraApiToken: 'your-api-token',
    jiraProject: 'PROJ',
    
    // 보안
    sessionTimeout: '30',
    maxLoginAttempts: '5',
    enableTwoFactor: false,
    
    // 알림
    emailNotifications: true,
    slackNotifications: false,
    webhookUrl: '',
    
    // 화면 설정
    theme: 'light',
    language: 'ko',
    timezone: 'Asia/Seoul'
  })

  const handleSave = async () => {
    setIsLoading(true)
    // 설정 저장 로직
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsLoading(false)
  }

  const testConnection = async (type: string) => {
    setIsLoading(true)
    // 연결 테스트 로직
    await new Promise(resolve => setTimeout(resolve, 2000))
    setIsLoading(false)
  }

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">시스템 정보</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">시스템 이름</label>
            <input
              type="text"
              value={settings.systemName}
              onChange={(e) => updateSetting('systemName', e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">최대 파일 크기 (MB)</label>
            <input
              type="number"
              value={settings.maxFileSize}
              onChange={(e) => updateSetting('maxFileSize', e.target.value)}
              className="input"
            />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">시스템 설명</label>
          <textarea
            value={settings.systemDescription}
            onChange={(e) => updateSetting('systemDescription', e.target.value)}
            rows={3}
            className="input"
          />
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">파일 업로드 설정</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">허용된 파일 형식</label>
          <div className="flex flex-wrap gap-2">
            {['pdf', 'docx', 'xlsx', 'md', 'txt', 'csv'].map(type => (
              <label key={type} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={settings.allowedFileTypes.includes(type)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateSetting('allowedFileTypes', [...settings.allowedFileTypes, type])
                    } else {
                      updateSetting('allowedFileTypes', settings.allowedFileTypes.filter(t => t !== type))
                    }
                  }}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">.{type}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )

  const renderDatabaseSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">데이터베이스 연결</h3>
        <button
          onClick={() => testConnection('database')}
          disabled={isLoading}
          className="btn btn-outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          연결 테스트
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">호스트</label>
          <input
            type="text"
            value={settings.dbHost}
            onChange={(e) => updateSetting('dbHost', e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">포트</label>
          <input
            type="text"
            value={settings.dbPort}
            onChange={(e) => updateSetting('dbPort', e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">데이터베이스명</label>
          <input
            type="text"
            value={settings.dbName}
            onChange={(e) => updateSetting('dbName', e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">사용자명</label>
          <input
            type="text"
            value={settings.dbUser}
            onChange={(e) => updateSetting('dbUser', e.target.value)}
            className="input"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={settings.dbPassword}
            onChange={(e) => updateSetting('dbPassword', e.target.value)}
            className="input pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-gray-400" />
            ) : (
              <Eye className="h-4 w-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>
    </div>
  )

  const renderJiraSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Jira 연동 설정</h3>
        <button
          onClick={() => testConnection('jira')}
          disabled={isLoading}
          className="btn btn-outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          연결 테스트
        </button>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Jira URL</label>
          <input
            type="url"
            value={settings.jiraUrl}
            onChange={(e) => updateSetting('jiraUrl', e.target.value)}
            className="input"
            placeholder="https://your-company.atlassian.net"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">사용자명 (이메일)</label>
          <input
            type="email"
            value={settings.jiraUsername}
            onChange={(e) => updateSetting('jiraUsername', e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API 토큰</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={settings.jiraApiToken}
              onChange={(e) => updateSetting('jiraApiToken', e.target.value)}
              className="input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-gray-400" />
              ) : (
                <Eye className="h-4 w-4 text-gray-400" />
              )}
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Jira 계정 설정에서 API 토큰을 생성해주세요.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">기본 프로젝트 키</label>
          <input
            type="text"
            value={settings.jiraProject}
            onChange={(e) => updateSetting('jiraProject', e.target.value)}
            className="input"
            placeholder="PROJ"
          />
        </div>
      </div>
    </div>
  )

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneralSettings()
      case 'database':
        return renderDatabaseSettings()
      case 'jira':
        return renderJiraSettings()
      default:
        return (
          <div className="text-center py-12">
            <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">준비 중</h3>
            <p className="mt-1 text-sm text-gray-500">
              이 설정 섹션은 아직 구현되지 않았습니다.
            </p>
          </div>
        )
    }
  }

  return (
    <div className="flex space-x-8">
      {/* 사이드바 */}
      <div className="w-64 flex-shrink-0">
        <nav className="space-y-1">
          {settingsSections.map((section) => {
            const Icon = section.icon
            const isActive = activeSection === section.id
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                <span>{section.name}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 max-w-4xl">
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {settingsSections.find(s => s.id === activeSection)?.name}
                </h2>
                <p className="text-sm text-gray-500">시스템 설정을 관리합니다</p>
              </div>
              <button
                onClick={handleSave}
                disabled={isLoading}
                className="btn btn-primary"
              >
                {isLoading ? (
                  <>
                    <div className="spinner mr-2" />
                    저장 중...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    설정 저장
                  </>
                )}
              </button>
            </div>
          </div>

          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {renderContent()}
          </motion.div>
        </div>

        {/* 시스템 상태 */}
        <div className="card mt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">시스템 상태</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-green-800">MCP 서버</p>
                <p className="text-xs text-green-600">정상 동작</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium text-green-800">데이터베이스</p>
                <p className="text-xs text-green-600">연결됨</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Jira 연동</p>
                <p className="text-xs text-yellow-600">설정 필요</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 