#!/usr/bin/env node

/**
 * Figure MCP 시스템 초기화 스크립트
 * 환경별 설정에 따라 사이트, 템플릿, 매칭룰 데이터를 초기화합니다.
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * 의미있는 UUID 관리 클래스
 * 물리적으론 UUID, 논리적으론 키 역할
 */
class LogicalUUIDManager {
  constructor() {
    // 의미있는 UUID 매핑 (하드코딩)
    this.LOGICAL_UUIDS = {
      SITES: {
        'default-site': 'site-default-0000-0000-0000-000000000001',
        'dev-site': 'site-dev-site-0000-0000-0000-000000000002',
        'staging-site': 'site-staging-0000-0000-0000-000000000003'
      },
      TEMPLATES: {
        'api-documentation': 'tmpl-api-doc-0000-0000-0000-000000000001',
        'deployment-guide': 'tmpl-deploy-0000-0000-0000-000000000002',
        'requirements': 'tmpl-require-0000-0000-0000-000000000003',
        'table-specification': 'tmpl-table-0000-0000-0000-000000000004',
        'test-plan': 'tmpl-test-0000-0000-0000-000000000005'
      }
    };
    
    console.log('🔑 의미있는 UUID 시스템 초기화 완료');
  }

  /**
   * 논리키로 의미있는 UUID 조회
   */
  getUUID(type, key) {
    const typeMap = {
      'site': this.LOGICAL_UUIDS.SITES,
      'template': this.LOGICAL_UUIDS.TEMPLATES
    };
    
    const uuidMap = typeMap[type];
    if (!uuidMap || !uuidMap[key]) {
      console.warn(`⚠️ 알 수 없는 논리키: ${type}.${key}`);
      return null;
    }
    
    return uuidMap[key];
  }

  /**
   * 매칭룰 처리 (이미 의미있는 UUID 사용)
   */
  processMatchingRule(rule) {
    // 이미 template_id, site_id가 의미있는 UUID로 설정되어 있음
    return { ...rule };
  }

  /**
   * 사이트 정보 처리
   */
  processSiteInfo(siteInfo) {
    // 환경 설정에서 이미 의미있는 UUID 사용
    return { ...siteInfo };
  }

  /**
   * 템플릿 정보 처리
   */
  processTemplateInfo(template) {
    // 템플릿 타입에서 의미있는 UUID 생성
    const templateKey = this.getTemplateKeyFromType(template.type);
    const templateId = this.getUUID('template', templateKey);
    
    return {
      ...template,
      id: templateId || uuidv4() // fallback
    };
  }

  /**
   * 템플릿 타입에서 키 생성
   */
  getTemplateKeyFromType(type) {
    const keyMap = {
      'API_DOCUMENTATION': 'api-documentation',
      'DEPLOYMENT_GUIDE': 'deployment-guide',
      'REQUIREMENTS': 'requirements',
      'TABLE_SPECIFICATION': 'table-specification',
      'TEST_PLAN': 'test-plan'
    };
    
    return keyMap[type] || 'unknown';
  }

  /**
   * 매핑 결과 반환
   */
  getMappings() {
    return {
      sites: this.LOGICAL_UUIDS.SITES,
      templates: this.LOGICAL_UUIDS.TEMPLATES
    };
  }
}

class FigureMCPInitializer {
  constructor(environment = 'development') {
    this.environment = environment;
    this.baseDir = path.join(__dirname, '..');
    this.envConfig = this.loadEnvironmentConfig();
    this.initDate = new Date().toISOString();
    this.uuidManager = new LogicalUUIDManager();
  }

  /**
   * 환경 설정 로드
   */
  loadEnvironmentConfig() {
    const configPath = path.join(this.baseDir, 'environments', `${this.environment}.json`);
    
    if (!fs.existsSync(configPath)) {
      throw new Error(`Environment config not found: ${configPath}`);
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log(`📋 환경 설정 로드됨: ${config.environment}`);
    return config;
  }

  /**
   * 사이트 정보 초기화
   */
  async initializeSites() {
    console.log('🏢 사이트 정보 초기화 중...');
    
    // 환경 설정에서 이미 의미있는 UUID 사용
    const siteData = this.uuidManager.processSiteInfo({
      ...this.envConfig.site,
      environment: this.environment,
      created_at: this.initDate,
      updated_at: this.initDate
    });

    // 실제 구현에서는 데이터베이스에 저장
    console.log('✅ 사이트 정보:', siteData.name);
    console.log('🔑 사이트 ID (의미있는 UUID):', siteData.id);
    return siteData;
  }

  /**
   * 템플릿 정보 초기화
   */
  async initializeTemplates() {
    console.log('📝 템플릿 정보 초기화 중...');
    
    const templatesDir = path.join(this.baseDir, 'base', 'templates');
    const templateFiles = fs.readdirSync(templatesDir).filter(file => file.endsWith('.md'));
    
    const templates = [];
    
    for (const file of templateFiles) {
      const templatePath = path.join(templatesDir, file);
      const content = fs.readFileSync(templatePath, 'utf8');
      
      // 파일명에서 템플릿 타입 추출
      const templateType = this.getTemplateTypeFromFilename(file);
      
      // 의미있는 UUID로 템플릿 처리
      const template = this.uuidManager.processTemplateInfo({
        name: this.getTemplateNameFromType(templateType),
        type: templateType,
        file_path: `data/base/templates/${file}`,
        content: content,
        variables: this.extractVariablesFromTemplate(content),
        environment: this.environment,
        is_active: true,
        created_at: this.initDate,
        updated_at: this.initDate
      });
      
      templates.push(template);
      console.log(`✅ 템플릿 로드됨: ${template.name}`);
    }
    
    return templates;
  }

  /**
   * 매칭룰 정보 초기화
   */
  async initializeMatchingRules() {
    console.log('🔗 매칭룰 정보 초기화 중...');
    
    const rulesDir = path.join(this.baseDir, 'base', 'matching-rules');
    const ruleFiles = fs.readdirSync(rulesDir).filter(file => file.endsWith('.json'));
    
    const matchingRules = [];
    
    for (const file of ruleFiles) {
      const rulePath = path.join(rulesDir, file);
      const ruleData = JSON.parse(fs.readFileSync(rulePath, 'utf8'));
      
      // 이미 의미있는 UUID가 설정되어 있음
      const processedRule = this.uuidManager.processMatchingRule({
        ...ruleData,
        environment: this.environment,
        created_at: this.initDate,
        updated_at: this.initDate
      });
      
      matchingRules.push(processedRule);
      console.log(`✅ 매칭룰 로드됨: ${processedRule.description}`);
      console.log(`🔗 템플릿 ID (의미있는): ${processedRule.template_id}`);
      console.log(`🏢 사이트 ID (의미있는): ${processedRule.site_id}`);
    }
    
    return matchingRules;
  }

  /**
   * 전체 시스템 초기화 실행
   */
  async initialize() {
    console.log(`🚀 Figure MCP 시스템 초기화 시작 (환경: ${this.environment})`);
    console.log('=' .repeat(60));
    
    try {
      // 1. 사이트 초기화
      const siteData = await this.initializeSites();
      
      // 2. 템플릿 초기화
      const templates = await this.initializeTemplates();
      
      // 3. 매칭룰 초기화
      const matchingRules = await this.initializeMatchingRules();
      
      // 4. 초기화 결과 저장
      const initResult = {
        environment: this.environment,
        initialized_at: this.initDate,
        site: siteData,
        templates: templates,
        matching_rules: matchingRules,
        logical_uuids: this.uuidManager.getMappings(),
        summary: {
          total_templates: templates.length,
          total_matching_rules: matchingRules.length,
          active_templates: templates.filter(t => t.is_active).length,
          active_matching_rules: matchingRules.filter(r => r.is_active).length,
          logical_uuid_count: Object.keys(this.uuidManager.LOGICAL_UUIDS.SITES).length + Object.keys(this.uuidManager.LOGICAL_UUIDS.TEMPLATES).length
        }
      };
      
      // 결과 파일 저장
      const resultPath = path.join(this.baseDir, 'scripts', `init-result-${this.environment}.json`);
      fs.writeFileSync(resultPath, JSON.stringify(initResult, null, 2));
      
      console.log('=' .repeat(60));
      console.log('🎉 시스템 초기화 완료!');
      console.log(`📊 템플릿: ${templates.length}개`);
      console.log(`🔗 매칭룰: ${matchingRules.length}개`);
      console.log(`📄 결과 파일: ${resultPath}`);
      
      return initResult;
      
    } catch (error) {
      console.error('❌ 초기화 실패:', error.message);
      throw error;
    }
  }

  /**
   * 파일명에서 템플릿 타입 추출
   */
  getTemplateTypeFromFilename(filename) {
    const typeMap = {
      'api_documentation_template.md': 'API_DOCUMENTATION',
      'deployment_guide_template.md': 'DEPLOYMENT_GUIDE',
      'requirements_template.md': 'REQUIREMENTS',
      'table_specification_template.md': 'TABLE_SPECIFICATION',
      'test_plan_template.md': 'TEST_PLAN'
    };
    
    return typeMap[filename] || 'UNKNOWN';
  }

  /**
   * 템플릿 타입에서 이름 생성
   */
  getTemplateNameFromType(type) {
    const nameMap = {
      'API_DOCUMENTATION': 'API 문서 템플릿',
      'DEPLOYMENT_GUIDE': '배포 가이드 템플릿',
      'REQUIREMENTS': '요구사항 정의서 템플릿',
      'TABLE_SPECIFICATION': '테이블 명세서 템플릿',
      'TEST_PLAN': '테스트 계획서 템플릿'
    };
    
    return nameMap[type] || '알 수 없는 템플릿';
  }

  /**
   * 템플릿 타입에서 키 생성
   */
  getTemplateKeyFromType(type) {
    const keyMap = {
      'API_DOCUMENTATION': 'api-documentation-template',
      'DEPLOYMENT_GUIDE': 'deployment-guide-template',
      'REQUIREMENTS': 'requirements-template',
      'TABLE_SPECIFICATION': 'table-specification-template',
      'TEST_PLAN': 'test-plan-template'
    };
    
    return keyMap[type] || 'unknown-template';
  }

  /**
   * 템플릿에서 변수 추출
   */
  extractVariablesFromTemplate(content) {
    const variableRegex = /\{([^}]+)\}/g;
    const variables = new Set();
    let match;
    
    while ((match = variableRegex.exec(content)) !== null) {
      variables.add(match[1]);
    }
    
    return Array.from(variables).map(variable => ({
      name: variable,
      type: 'string',
      required: true,
      description: `${variable} 값`
    }));
  }
}

/**
 * CLI 실행부
 */
if (require.main === module) {
  const environment = process.argv[2] || 'development';
  
  console.log('Figure MCP 시스템 초기화 도구');
  console.log(`사용법: node init-system.js [environment]`);
  console.log(`환경: development, staging, production`);
  console.log('');
  
  const initializer = new FigureMCPInitializer(environment);
  
  initializer.initialize()
    .then(result => {
      console.log('초기화가 성공적으로 완료되었습니다.');
      process.exit(0);
    })
    .catch(error => {
      console.error('초기화 중 오류가 발생했습니다:', error);
      process.exit(1);
    });
}

module.exports = FigureMCPInitializer;
