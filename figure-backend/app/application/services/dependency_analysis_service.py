"""
의존성 분석 서비스
고급 의존성 분석, 영향도 점수 계산, 종합 리포트 생성 기능 제공
"""
import os
import logging
from typing import Dict, List, Optional, Any, Set, Tuple
from dataclasses import dataclass
from collections import defaultdict, deque

from app.application.services.code_analysis_service import CodeAnalysisService
from app.application.services.schema_analysis_service import SchemaAnalysisService

logger = logging.getLogger(__name__)

@dataclass
class CircularDependency:
    """순환 의존성 정보"""
    cycle: List[str]  # 순환 의존성 경로
    depth: int        # 순환 깊이
    severity: str     # 심각도 (low, medium, high)

@dataclass
class ImpactScore:
    """영향도 점수"""
    file_name: str
    score: int        # 0-100
    reason: str       # 점수 산출 근거
    risk_factors: List[str]

@dataclass
class ComponentImpact:
    """컴포넌트 영향도"""
    name: str
    impact_level: str  # low, medium, high
    reason: str

class DependencyAnalysisService:
    """의존성 분석 서비스"""
    
    def __init__(self):
        self.code_analysis_service = CodeAnalysisService()
        self.schema_analysis_service = SchemaAnalysisService()
        
        # 가중치 설정
        self.weights = {
            'dependency_count': 0.3,      # 의존성 개수
            'complexity': 0.25,           # 복잡도
            'usage_frequency': 0.2,       # 사용 빈도
            'file_size': 0.15,           # 파일 크기
            'test_coverage': 0.1          # 테스트 커버리지
        }
    
    async def detect_circular_dependencies(
        self,
        project_path: str,
        language: str,
        max_depth: int = 10
    ) -> Dict[str, Any]:
        """순환 의존성 탐지"""
        try:
            logger.info(f"순환 의존성 탐지 시작: {project_path}")
            
            # 메서드 의존성 정보 가져오기
            method_analysis = await self.code_analysis_service.analyze_method_dependencies(
                project_path, language
            )
            
            if method_analysis['method_count'] == 0:
                return self._create_empty_circular_result("분석할 메서드가 없습니다.")
            
            # 그래프 구축
            dependency_graph = self._build_dependency_graph(method_analysis)
            
            # 순환 의존성 탐지
            circular_dependencies = self._find_circular_dependencies(dependency_graph, max_depth)
            
            # 복잡도 지수 계산
            complexity_index = self._calculate_complexity_index(dependency_graph, circular_dependencies)
            
            # 권장사항 생성
            recommendations = self._generate_circular_recommendations(circular_dependencies)
            
            result = {
                'circular_dependencies': [
                    {
                        'cycle': cd.cycle,
                        'depth': cd.depth,
                        'severity': cd.severity
                    } for cd in circular_dependencies
                ],
                'total_files': method_analysis['analyzed_files'],
                'complexity_index': complexity_index,
                'recommendations': recommendations
            }
            
            logger.info(f"순환 의존성 탐지 완료: {len(circular_dependencies)}개 발견")
            return result
            
        except Exception as e:
            logger.error(f"순환 의존성 탐지 오류: {e}")
            return self._create_empty_circular_result(f"분석 중 오류: {str(e)}")
    
    async def calculate_impact_score(
        self,
        project_path: str,
        target_files: List[str],
        change_type: str,
        language: str
    ) -> Dict[str, Any]:
        """영향도 점수 계산"""
        try:
            logger.info(f"영향도 점수 계산 시작: {len(target_files)}개 파일")
            
            # 코드 분석
            method_analysis = await self.code_analysis_service.analyze_method_dependencies(
                project_path, language
            )
            
            file_scores = []
            total_score = 0
            
            for file_path in target_files:
                if not os.path.exists(file_path):
                    logger.warning(f"파일을 찾을 수 없음: {file_path}")
                    continue
                
                # 개별 파일 점수 계산
                score_info = await self._calculate_file_impact_score(
                    file_path, method_analysis, change_type, project_path
                )
                file_scores.append(score_info)
                total_score += score_info.score
            
            # 전체 점수 계산
            overall_score = min(100, total_score // len(file_scores) if file_scores else 0)
            
            # 리스크 요소 집계
            all_risk_factors = []
            for score_info in file_scores:
                all_risk_factors.extend(score_info.risk_factors)
            
            # 중복 제거 및 정렬
            unique_risks = list(set(all_risk_factors))
            
            # 권장사항 생성
            recommendations = self._generate_impact_recommendations(overall_score, change_type, unique_risks)
            
            result = {
                'overall_score': overall_score,
                'dependency_score': min(100, sum(1 for info in file_scores if '의존성' in info.reason) * 20),
                'complexity_score': min(100, sum(1 for info in file_scores if '복잡도' in info.reason) * 15),
                'usage_score': min(100, sum(1 for info in file_scores if '사용빈도' in info.reason) * 25),
                'file_scores': [
                    {
                        'fileName': score.file_name,
                        'score': score.score,
                        'reason': score.reason
                    } for score in file_scores
                ],
                'risk_factors': unique_risks[:10],  # 상위 10개
                'recommendations': recommendations
            }
            
            logger.info(f"영향도 점수 계산 완료: {overall_score}/100")
            return result
            
        except Exception as e:
            logger.error(f"영향도 점수 계산 오류: {e}")
            return self._create_empty_score_result(f"계산 중 오류: {str(e)}")
    
    async def generate_comprehensive_report(
        self,
        project_path: str,
        change_description: str,
        target_modules: List[str],
        language: str,
        include_database: bool = False,
        database_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """종합 영향도 분석 리포트 생성"""
        try:
            logger.info(f"종합 리포트 생성 시작: {project_path}")
            
            # 기본 분석들 수행
            impact_result = await self.calculate_impact_score(
                project_path, target_modules, "modify", language
            )
            
            circular_result = await self.detect_circular_dependencies(
                project_path, language
            )
            
            # 영향 받는 컴포넌트 분석
            affected_components = await self._analyze_affected_components(
                project_path, target_modules, language
            )
            
            # 리스크 분석
            identified_risks = self._identify_comprehensive_risks(
                impact_result, circular_result, change_description
            )
            
            # 전체 위험도 평가
            overall_risk_level = self._evaluate_overall_risk(impact_result['overall_score'])
            
            # 테스트 권장사항
            test_recommendations = self._generate_test_recommendations(
                target_modules, affected_components, overall_risk_level
            )
            
            # 배포 권장사항
            deployment_recommendations = self._generate_deployment_recommendations(
                overall_risk_level, identified_risks
            )
            
            # 체크리스트 생성
            checklist = self._generate_comprehensive_checklist(
                overall_risk_level, include_database
            )
            
            result = {
                'overall_risk_level': overall_risk_level,
                'impact_score': impact_result['overall_score'],
                'dependency_impact': f"{len(circular_result.get('circular_dependencies', []))}개 순환 의존성",
                'complexity_impact': circular_result.get('complexity_index', '보통'),
                'user_impact': self._assess_user_impact(target_modules),
                'affected_components': [
                    {
                        'name': comp.name,
                        'impactLevel': comp.impact_level,
                        'reason': comp.reason
                    } for comp in affected_components
                ],
                'identified_risks': identified_risks,
                'test_recommendations': test_recommendations,
                'deployment_recommendations': deployment_recommendations,
                'checklist': checklist
            }
            
            # 데이터베이스 영향도 포함
            if include_database and database_type:
                db_impact = await self._analyze_database_impact(database_type)
                result['database_impact'] = db_impact
            
            logger.info(f"종합 리포트 생성 완료: {overall_risk_level}")
            return result
            
        except Exception as e:
            logger.error(f"종합 리포트 생성 오류: {e}")
            return self._create_empty_report_result(f"생성 중 오류: {str(e)}")
    
    def _build_dependency_graph(self, method_analysis: Dict[str, Any]) -> Dict[str, Set[str]]:
        """의존성 그래프 구축"""
        graph = defaultdict(set)
        
        # 메서드 분석에서 의존성 정보 추출 (시뮬레이션)
        # 실제로는 method_analysis에서 메서드 호출 관계를 파싱해야 함
        files = [f"File_{i}" for i in range(method_analysis.get('analyzed_files', 0))]
        
        for i, file in enumerate(files):
            # 시뮬레이션: 각 파일이 다른 파일들에 의존성을 가지도록 설정
            for j in range(min(3, len(files))):  # 최대 3개 의존성
                if i != j:
                    graph[file].add(files[j])
        
        return dict(graph)
    
    def _find_circular_dependencies(
        self, 
        graph: Dict[str, Set[str]], 
        max_depth: int
    ) -> List[CircularDependency]:
        """순환 의존성 탐지 (DFS 기반)"""
        circular_deps = []
        visited = set()
        rec_stack = set()
        
        def dfs(node: str, path: List[str], depth: int) -> None:
            if depth > max_depth:
                return
                
            if node in rec_stack:
                # 순환 의존성 발견
                cycle_start = path.index(node)
                cycle = path[cycle_start:] + [node]
                
                severity = "high" if len(cycle) <= 3 else "medium" if len(cycle) <= 5 else "low"
                
                circular_deps.append(CircularDependency(
                    cycle=cycle,
                    depth=len(cycle),
                    severity=severity
                ))
                return
            
            if node in visited:
                return
            
            visited.add(node)
            rec_stack.add(node)
            path.append(node)
            
            for neighbor in graph.get(node, set()):
                dfs(neighbor, path.copy(), depth + 1)
            
            rec_stack.remove(node)
        
        for node in graph:
            if node not in visited:
                dfs(node, [], 0)
        
        return circular_deps[:10]  # 최대 10개만 반환
    
    def _calculate_complexity_index(
        self, 
        graph: Dict[str, Set[str]], 
        circular_deps: List[CircularDependency]
    ) -> str:
        """복잡도 지수 계산"""
        if not graph:
            return "없음"
        
        total_edges = sum(len(deps) for deps in graph.values())
        total_nodes = len(graph)
        
        avg_degree = total_edges / total_nodes if total_nodes > 0 else 0
        circular_count = len(circular_deps)
        
        if circular_count > 3 or avg_degree > 5:
            return "높음"
        elif circular_count > 1 or avg_degree > 2:
            return "보통"
        else:
            return "낮음"
    
    def _generate_circular_recommendations(self, circular_deps: List[CircularDependency]) -> List[str]:
        """순환 의존성 권장사항 생성"""
        if not circular_deps:
            return ["순환 의존성이 발견되지 않았습니다. 좋은 코드 구조를 유지하고 있습니다."]
        
        recommendations = []
        high_severity_count = sum(1 for cd in circular_deps if cd.severity == "high")
        
        if high_severity_count > 0:
            recommendations.append(f"높은 심각도의 순환 의존성 {high_severity_count}개를 우선 해결하세요.")
        
        recommendations.extend([
            "의존성 역전 원칙(DIP)을 적용하여 인터페이스를 도입하세요.",
            "순환 참조하는 모듈을 별도 모듈로 분리하는 것을 고려하세요.",
            "코드 리뷰 시 순환 의존성 체크를 포함하세요."
        ])
        
        return recommendations
    
    async def _calculate_file_impact_score(
        self,
        file_path: str,
        method_analysis: Dict[str, Any],
        change_type: str,
        project_path: str
    ) -> ImpactScore:
        """개별 파일 영향도 점수 계산"""
        base_score = 30  # 기본 점수
        risk_factors = []
        reasons = []
        
        try:
            # 파일 크기 분석
            file_size = os.path.getsize(file_path)
            if file_size > 10000:  # 10KB 이상
                base_score += 15
                risk_factors.append("대용량 파일")
                reasons.append("파일 크기")
            
            # 변경 유형별 가중치
            change_weights = {
                'add': 1.0,
                'modify': 1.2,
                'delete': 1.5,
                'refactor': 1.3
            }
            
            base_score = int(base_score * change_weights.get(change_type, 1.0))
            
            # 의존성 개수 (시뮬레이션)
            dependency_count = method_analysis.get('total_dependencies', 0) // method_analysis.get('analyzed_files', 1)
            if dependency_count > 10:
                base_score += 20
                risk_factors.append("높은 의존성")
                reasons.append("의존성 개수")
            
            # 복잡도 (시뮬레이션)
            complexity = method_analysis.get('complexity_level', '낮음')
            if complexity == '높음':
                base_score += 25
                risk_factors.append("높은 복잡도")
                reasons.append("복잡도")
            elif complexity == '보통':
                base_score += 10
            
            # 파일명 패턴 분석
            file_name = os.path.basename(file_path).lower()
            if any(keyword in file_name for keyword in ['service', 'manager', 'controller']):
                base_score += 15
                risk_factors.append("핵심 컴포넌트")
                reasons.append("사용빈도")
            
        except Exception as e:
            logger.warning(f"파일 분석 오류 ({file_path}): {e}")
        
        final_score = min(100, base_score)
        reason_text = ", ".join(reasons) if reasons else "기본 영향도"
        
        return ImpactScore(
            file_name=os.path.basename(file_path),
            score=final_score,
            reason=reason_text,
            risk_factors=risk_factors
        )
    
    def _generate_impact_recommendations(
        self, 
        overall_score: int, 
        change_type: str, 
        risk_factors: List[str]
    ) -> List[str]:
        """영향도 기반 권장사항 생성"""
        recommendations = []
        
        if overall_score >= 80:
            recommendations.extend([
                "높은 위험도: 단계적 배포 및 충분한 테스트가 필요합니다.",
                "롤백 계획을 사전에 준비하세요.",
                "핵심 기능에 대한 모니터링을 강화하세요."
            ])
        elif overall_score >= 50:
            recommendations.extend([
                "중간 위험도: 통합 테스트를 강화하세요.",
                "영향 받는 모듈에 대한 회귀 테스트를 수행하세요."
            ])
        else:
            recommendations.append("낮은 위험도: 기본적인 테스트로 충분합니다.")
        
        # 변경 유형별 권장사항
        if change_type == "delete":
            recommendations.append("삭제 전 의존성을 철저히 확인하세요.")
        elif change_type == "refactor":
            recommendations.append("리팩토링 후 성능 테스트를 수행하세요.")
        
        return recommendations
    
    async def _analyze_affected_components(
        self, 
        project_path: str, 
        target_modules: List[str], 
        language: str
    ) -> List[ComponentImpact]:
        """영향 받는 컴포넌트 분석"""
        components = []
        
        for module in target_modules:
            module_name = os.path.basename(module)
            
            # 컴포넌트 타입별 영향도 분석 (시뮬레이션)
            if any(keyword in module_name.lower() for keyword in ['service', 'manager']):
                components.append(ComponentImpact(
                    name=module_name,
                    impact_level="high",
                    reason="비즈니스 로직 핵심 컴포넌트"
                ))
            elif any(keyword in module_name.lower() for keyword in ['controller', 'api']):
                components.append(ComponentImpact(
                    name=module_name,
                    impact_level="medium",
                    reason="API 인터페이스 컴포넌트"
                ))
            else:
                components.append(ComponentImpact(
                    name=module_name,
                    impact_level="low",
                    reason="일반 컴포넌트"
                ))
        
        return components
    
    def _identify_comprehensive_risks(
        self, 
        impact_result: Dict[str, Any], 
        circular_result: Dict[str, Any], 
        change_description: str
    ) -> List[Dict[str, str]]:
        """종합 리스크 분석"""
        risks = []
        
        # 영향도 점수 기반 리스크
        if impact_result['overall_score'] >= 80:
            risks.append({
                'category': '높은 영향도',
                'description': f"종합 영향도 점수 {impact_result['overall_score']}/100으로 높은 위험",
                'severity': '높음'
            })
        
        # 순환 의존성 기반 리스크
        circular_count = len(circular_result.get('circular_dependencies', []))
        if circular_count > 0:
            risks.append({
                'category': '순환 의존성',
                'description': f"{circular_count}개의 순환 의존성이 변경 시 예측 불가능한 영향 야기 가능",
                'severity': '높음' if circular_count > 3 else '보통'
            })
        
        # 변경 내용 기반 리스크
        if any(keyword in change_description.lower() for keyword in ['database', 'db', '테이블']):
            risks.append({
                'category': '데이터베이스 변경',
                'description': '데이터베이스 구조 변경으로 인한 데이터 무결성 위험',
                'severity': '높음'
            })
        
        return risks[:5]  # 최대 5개
    
    def _evaluate_overall_risk(self, impact_score: int) -> str:
        """전체 위험도 평가"""
        if impact_score >= 80:
            return "높음"
        elif impact_score >= 50:
            return "보통"
        else:
            return "낮음"
    
    def _generate_test_recommendations(
        self, 
        target_modules: List[str], 
        affected_components: List[ComponentImpact], 
        risk_level: str
    ) -> List[str]:
        """테스트 권장사항 생성"""
        recommendations = []
        
        if risk_level == "높음":
            recommendations.extend([
                "전체 시스템 통합 테스트 수행",
                "성능 테스트 및 부하 테스트 실시",
                "A/B 테스트를 통한 단계적 배포"
            ])
        elif risk_level == "보통":
            recommendations.extend([
                "영향 받는 모듈에 대한 회귀 테스트",
                "API 테스트 및 계약 테스트 수행"
            ])
        else:
            recommendations.append("기본 단위 테스트 및 간단한 통합 테스트")
        
        # 고영향 컴포넌트별 추가 권장사항
        high_impact_components = [c for c in affected_components if c.impact_level == "high"]
        if high_impact_components:
            recommendations.append(f"핵심 컴포넌트 {len(high_impact_components)}개에 대한 집중 테스트")
        
        return recommendations
    
    def _generate_deployment_recommendations(
        self, 
        risk_level: str, 
        identified_risks: List[Dict[str, str]]
    ) -> List[str]:
        """배포 권장사항 생성"""
        recommendations = []
        
        if risk_level == "높음":
            recommendations.extend([
                "블루-그린 배포 또는 카나리 배포 적용",
                "실시간 모니터링 및 알람 설정",
                "즉시 롤백 가능한 체계 구축"
            ])
        elif risk_level == "보통":
            recommendations.extend([
                "단계적 배포 (dev → staging → production)",
                "핵심 메트릭 모니터링"
            ])
        else:
            recommendations.append("일반적인 배포 프로세스 적용")
        
        # 리스크별 추가 권장사항
        for risk in identified_risks:
            if risk['category'] == '데이터베이스 변경':
                recommendations.append("데이터베이스 백업 및 마이그레이션 스크립트 준비")
        
        return recommendations
    
    def _generate_comprehensive_checklist(
        self, 
        risk_level: str, 
        include_database: bool
    ) -> List[Dict[str, str]]:
        """종합 체크리스트 생성"""
        checklist = [
            {'category': '개발', 'task': '코드 리뷰 완료 및 승인'},
            {'category': '개발', 'task': '단위 테스트 작성 및 통과'},
            {'category': '테스트', 'task': '통합 테스트 수행'},
            {'category': '배포', 'task': '배포 계획 및 일정 확정'}
        ]
        
        if risk_level == "높음":
            checklist.extend([
                {'category': '테스트', 'task': '성능 테스트 및 부하 테스트'},
                {'category': '배포', 'task': '롤백 계획 및 절차 준비'},
                {'category': '모니터링', 'task': '실시간 모니터링 설정'}
            ])
        
        if include_database:
            checklist.extend([
                {'category': '데이터베이스', 'task': '데이터베이스 백업 수행'},
                {'category': '데이터베이스', 'task': '마이그레이션 스크립트 검증'}
            ])
        
        return checklist
    
    def _assess_user_impact(self, target_modules: List[str]) -> str:
        """사용자 영향도 평가"""
        ui_modules = sum(1 for module in target_modules 
                        if any(keyword in module.lower() for keyword in ['ui', 'view', 'component', 'page']))
        
        if ui_modules > len(target_modules) * 0.5:
            return "높음 (UI 변경 다수)"
        elif ui_modules > 0:
            return "보통 (일부 UI 변경)"
        else:
            return "낮음 (백엔드 변경 위주)"
    
    async def _analyze_database_impact(self, database_type: str) -> Dict[str, Any]:
        """데이터베이스 영향도 분석 (시뮬레이션)"""
        return {
            'affected_tables': ['users', 'orders', 'products'],
            'migration_required': True,
            'backup_recommended': True,
            'estimated_downtime': '10-15분'
        }
    
    def _create_empty_circular_result(self, message: str) -> Dict[str, Any]:
        """빈 순환 의존성 결과 생성"""
        return {
            'circular_dependencies': [],
            'total_files': 0,
            'complexity_index': '없음',
            'recommendations': [f"분석 실패: {message}"]
        }
    
    def _create_empty_score_result(self, message: str) -> Dict[str, Any]:
        """빈 점수 결과 생성"""
        return {
            'overall_score': 0,
            'dependency_score': 0,
            'complexity_score': 0,
            'usage_score': 0,
            'file_scores': [],
            'risk_factors': [f"계산 실패: {message}"],
            'recommendations': []
        }
    
    def _create_empty_report_result(self, message: str) -> Dict[str, Any]:
        """빈 리포트 결과 생성"""
        return {
            'overall_risk_level': '알 수 없음',
            'impact_score': 0,
            'dependency_impact': '분석 실패',
            'complexity_impact': '분석 실패',
            'user_impact': '분석 실패',
            'affected_components': [],
            'identified_risks': [{'category': '분석 오류', 'description': message, 'severity': '높음'}],
            'test_recommendations': ['분석을 다시 수행하세요.'],
            'deployment_recommendations': ['분석을 다시 수행하세요.'],
            'checklist': [{'category': '오류', 'task': '분석 오류 해결'}]
        }