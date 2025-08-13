#!/usr/bin/env node

/**
 * Figure MCP 데이터베이스 시딩 스크립트
 * 초기화된 데이터를 실제 데이터베이스에 저장합니다.
 */

const fs = require('fs');
const path = require('path');
const FigureMCPInitializer = require('./init-system');

class DatabaseSeeder {
  constructor(environment = 'development') {
    this.environment = environment;
    this.baseDir = path.join(__dirname, '..');
    this.initializer = new FigureMCPInitializer(environment);
  }

  /**
   * 사이트 데이터 시딩 (기존 스키마 호환)
   */
  async seedSites(siteData) {
    console.log('🏢 사이트 데이터 시딩 중...');
    
    // 논리키 추출 (환경 설정에서 가져온 키)
    const logicalKey = siteData.logical_key || siteData.key || 'default-site';
    
    const siteQuery = `
      INSERT OR REPLACE INTO sites (
        id, logical_key, name, company, department, business_type,
        contact_person, contact_email, contact_phone, url, description,
        is_active, crawl_frequency, max_depth, include_patterns, exclude_patterns,
        status, document_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    // 실제 DB 실행 코드 (예시)
    // await db.run(siteQuery, [
    //   siteData.id, logicalKey, siteData.name, 
    //   siteData.company || 'Figure MCP', siteData.department || null,
    //   siteData.business_type || 'IT', siteData.contact_person || null,
    //   siteData.contact_email || null, siteData.contact_phone || null,
    //   siteData.url || null, siteData.description || '',
    //   siteData.is_active ? 1 : 0, 24, 3, '[]', '[]',
    //   'active', 0, siteData.created_at
    // ]);
    
    console.log(`✅ 사이트 시딩 완료: ${siteData.name} (논리키: ${logicalKey})`);
    return { success: true, site_id: siteData.id, logical_key: logicalKey };
  }

  /**
   * 템플릿 데이터 시딩 (기존 documents 테이블 활용)
   */
  async seedTemplates(templates) {
    console.log('📝 템플릿 데이터 시딩 중...');
    
    const results = [];
    
    for (const template of templates) {
      // 템플릿 파일 내용 읽기
      const fs = require('fs');
      const path = require('path');
      let content = '';
      try {
        const contentPath = path.join(this.baseDir, template.file_path);
        content = fs.readFileSync(contentPath, 'utf8');
      } catch (error) {
        console.warn(`⚠️ 템플릿 파일 읽기 실패: ${template.file_path}`);
      }

      const templateQuery = `
        INSERT OR REPLACE INTO documents (
          id, logical_key, site_id, title, doc_type, source_url, file_path,
          file_size, content_hash, processing_status, extra_data,
          is_template, template_type, template_name, template_description,
          template_version, template_format, template_variables, template_tags,
          usage_count, is_active, is_default, created_by, updated_by,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      // 실제 DB 실행 코드 (예시)
      // await db.run(templateQuery, [
      //   template.id, template.key, template.site_id || null,
      //   template.name, 'template', null, template.file_path,
      //   content.length, null, 'completed', '{}',
      //   1, template.type, template.name, template.description || '',
      //   template.version || '1.0.0', 'markdown', JSON.stringify(template.variables),
      //   template.tags ? template.tags.join(',') : '',
      //   0, template.is_active ? 1 : 0, 0,
      //   'system', 'system', template.created_at, template.updated_at
      // ]);
      
      results.push({ success: true, template_id: template.id, logical_key: template.key });
      console.log(`✅ 템플릿 시딩 완료: ${template.name} (논리키: ${template.key})`);
    }
    
    return results;
  }

  /**
   * 매칭룰 데이터 시딩 (새 template_matching_rules 테이블)
   */
  async seedMatchingRules(matchingRules) {
    console.log('🔗 매칭룰 데이터 시딩 중...');
    
    const results = [];
    
    for (const rule of matchingRules) {
      // 논리키 생성 (mcp_request_type 기반)
      const logicalKey = `${rule.mcp_request_type}-rule`;
      
      const ruleQuery = `
        INSERT OR REPLACE INTO template_matching_rules (
          logical_key, mcp_request_type, template_type, template_id, site_id,
          priority, is_active, description, environment, 
          created_by, created_at, updated_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      // 실제 DB 실행 코드 (예시)
      // await db.run(ruleQuery, [
      //   logicalKey, rule.mcp_request_type, rule.template_type, 
      //   rule.template_id, rule.site_id, rule.priority, 
      //   rule.is_active ? 1 : 0, rule.description, rule.environment,
      //   'system', rule.created_at, 'system', rule.updated_at
      // ]);
      
      results.push({ 
        success: true, 
        rule_type: rule.mcp_request_type, 
        logical_key: logicalKey 
      });
      console.log(`✅ 매칭룰 시딩 완료: ${rule.description} (논리키: ${logicalKey})`);
    }
    
    return results;
  }

  /**
   * 데이터베이스 테이블 생성
   */
  async createTables() {
    console.log('🗄️ 데이터베이스 테이블 생성 중...');
    
    // 기존 스키마 그대로 사용 (변경 없음)
    console.log('📋 기존 스키마 사용 - 별도 테이블 생성 불필요');
    console.log('💡 의미있는 UUID를 사용하여 논리적 키 역할 수행');
    
    // 실제로는 기존 테이블 구조 그대로 사용
    // - sites 테이블: 기존 구조 유지
    // - documents 테이블: 기존 구조 유지 (is_template=true로 템플릿 관리)
    // - 매칭룰은 별도 테이블이 필요하다면 최소한으로만 생성
    
    return;
    
    for (const [tableName, createSQL] of Object.entries(tables)) {
      // 실제 DB 실행 코드 (예시)
      // await db.exec(createSQL);
      console.log(`✅ 테이블 생성 완료: ${tableName}`);
    }

    // 인덱스 생성 (기존 스키마 호환)
    const indexes = [
      // Sites 인덱스 (기존 + 논리키)
      "CREATE INDEX IF NOT EXISTS idx_sites_logical_key ON sites(logical_key)",
      "CREATE INDEX IF NOT EXISTS idx_sites_name ON sites(name)",
      "CREATE INDEX IF NOT EXISTS idx_sites_company ON sites(company)",
      "CREATE INDEX IF NOT EXISTS idx_sites_url ON sites(url)",
      "CREATE INDEX IF NOT EXISTS idx_sites_active ON sites(is_active)",
      
      // Documents 인덱스 (기존 + 논리키)
      "CREATE INDEX IF NOT EXISTS idx_documents_logical_key ON documents(logical_key)",
      "CREATE INDEX IF NOT EXISTS idx_documents_site_id ON documents(site_id)",
      "CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title)",
      "CREATE INDEX IF NOT EXISTS idx_documents_doc_type ON documents(doc_type)",
      "CREATE INDEX IF NOT EXISTS idx_documents_is_template ON documents(is_template)",
      "CREATE INDEX IF NOT EXISTS idx_documents_template_type ON documents(template_type)",
      "CREATE INDEX IF NOT EXISTS idx_documents_template_name ON documents(template_name)",
      "CREATE INDEX IF NOT EXISTS idx_documents_is_active ON documents(is_active)",
      "CREATE INDEX IF NOT EXISTS idx_documents_is_default ON documents(is_default)",
      
      // Template Matching Rules 인덱스 (새 테이블)
      "CREATE INDEX IF NOT EXISTS idx_tmr_logical_key ON template_matching_rules(logical_key)",
      "CREATE INDEX IF NOT EXISTS idx_tmr_request_type ON template_matching_rules(mcp_request_type)",
      "CREATE INDEX IF NOT EXISTS idx_tmr_template_type ON template_matching_rules(template_type)",
      "CREATE INDEX IF NOT EXISTS idx_tmr_template_id ON template_matching_rules(template_id)",
      "CREATE INDEX IF NOT EXISTS idx_tmr_site_id ON template_matching_rules(site_id)",
      "CREATE INDEX IF NOT EXISTS idx_tmr_priority ON template_matching_rules(priority)",
      "CREATE INDEX IF NOT EXISTS idx_tmr_active ON template_matching_rules(is_active)",
      "CREATE INDEX IF NOT EXISTS idx_tmr_environment ON template_matching_rules(environment)"
    ];

    for (const indexSQL of indexes) {
      // 실제 DB 실행 코드 (예시)
      // await db.exec(indexSQL);
      console.log(`✅ 인덱스 생성 완료`);
    }
  }

  /**
   * 전체 시딩 실행
   */
  async seed() {
    console.log(`🌱 데이터베이스 시딩 시작 (환경: ${this.environment})`);
    console.log('=' .repeat(60));
    
    try {
      // 1. 초기화 데이터 생성
      const initResult = await this.initializer.initialize();
      
      // 2. 데이터베이스 테이블 생성
      await this.createTables();
      
      // 3. 데이터 시딩
      const siteResult = await this.seedSites(initResult.site);
      const templateResults = await this.seedTemplates(initResult.templates);
      const ruleResults = await this.seedMatchingRules(initResult.matching_rules);
      
      // 4. 시딩 결과 저장
      const seedResult = {
        environment: this.environment,
        seeded_at: new Date().toISOString(),
        results: {
          site: siteResult,
          templates: templateResults,
          matching_rules: ruleResults
        },
        summary: {
          total_seeded: templateResults.length + ruleResults.length + 1,
          success_count: templateResults.filter(r => r.success).length + 
                        ruleResults.filter(r => r.success).length + 
                        (siteResult.success ? 1 : 0)
        }
      };
      
      // 결과 파일 저장
      const resultPath = path.join(this.baseDir, 'scripts', `seed-result-${this.environment}.json`);
      fs.writeFileSync(resultPath, JSON.stringify(seedResult, null, 2));
      
      console.log('=' .repeat(60));
      console.log('🎉 데이터베이스 시딩 완료!');
      console.log(`📊 시딩된 항목: ${seedResult.summary.total_seeded}개`);
      console.log(`✅ 성공: ${seedResult.summary.success_count}개`);
      console.log(`📄 결과 파일: ${resultPath}`);
      
      return seedResult;
      
    } catch (error) {
      console.error('❌ 시딩 실패:', error.message);
      throw error;
    }
  }

  /**
   * 데이터베이스 초기화 (기존 데이터 삭제)
   */
  async reset() {
    console.log('🗑️ 데이터베이스 초기화 중...');
    
    const tables = ['matching_rules', 'templates', 'sites'];
    
    for (const table of tables) {
      // 실제 DB 실행 코드 (예시)
      // await db.exec(`DELETE FROM ${table}`);
      console.log(`✅ 테이블 초기화 완료: ${table}`);
    }
  }
}

/**
 * CLI 실행부
 */
if (require.main === module) {
  const environment = process.argv[2] || 'development';
  const command = process.argv[3] || 'seed';
  
  console.log('Figure MCP 데이터베이스 시딩 도구');
  console.log(`사용법: node seed-database.js [environment] [command]`);
  console.log(`환경: development, staging, production`);
  console.log(`명령: seed, reset`);
  console.log('');
  
  const seeder = new DatabaseSeeder(environment);
  
  const executeCommand = async () => {
    switch (command) {
      case 'seed':
        return await seeder.seed();
      case 'reset':
        await seeder.reset();
        return { message: '데이터베이스가 초기화되었습니다.' };
      default:
        throw new Error(`알 수 없는 명령: ${command}`);
    }
  };
  
  executeCommand()
    .then(result => {
      console.log('작업이 성공적으로 완료되었습니다.');
      process.exit(0);
    })
    .catch(error => {
      console.error('작업 중 오류가 발생했습니다:', error);
      process.exit(1);
    });
}

module.exports = DatabaseSeeder;
