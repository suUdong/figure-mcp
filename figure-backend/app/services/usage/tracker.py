"""
API 사용량 추적 서비스
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database.models import UsageLog
from app.database.connection import db_manager


class UsageTracker:
    """API 사용량 추적 및 분석 서비스"""
    
    # 프로바이더별 비용 (1K 토큰당 USD)
    PROVIDER_COSTS = {
        "gemini": {
            "llm": 0.00015,  # Gemini 1.5 Flash
            "embedding": 0.00001  # Text Embedding 004
        },
        "groq": {
            "llm": 0.0001,  # Llama3 8B
            "embedding": 0.00001  # 추정값
        },
        "openai": {
            "llm": 0.0015,  # GPT-3.5 Turbo
            "embedding": 0.00001  # text-embedding-3-small
        }
    }
    
    def __init__(self):
        self.db_manager = db_manager
    
    def record_usage(
        self,
        provider: str,
        service: str,
        model: str,
        tokens_used: int,
        request_type: str,
        success: bool = True,
        error_message: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> None:
        """
        API 사용량 기록
        
        Args:
            provider: 프로바이더명 (gemini, groq, openai)
            service: 서비스 타입 (llm, embedding)
            model: 모델명
            tokens_used: 사용된 토큰 수
            request_type: 요청 타입 (query, embed, etc.)
            success: 성공 여부
            error_message: 오류 메시지 (실패 시)
            extra_data: 추가 메타데이터
        """
        try:
            # 비용 계산
            cost = self.calculate_cost(provider, service, tokens_used)
            
            # 사용량 로그 생성
            usage_log = UsageLog(
                provider=provider,
                service=service,
                model=model,
                tokens_used=tokens_used,
                cost=cost,
                request_type=request_type,
                success=success,
                error_message=error_message,
                extra_data=extra_data or {}
            )
            
            # 데이터베이스에 저장
            db = self.db_manager.get_session()
            try:
                db.add(usage_log)
                db.commit()
            finally:
                db.close()
                
        except Exception as e:
            print(f"❌ Error recording usage: {e}")
    
    def calculate_cost(self, provider: str, service: str, tokens_used: int) -> float:
        """
        토큰 사용량 기반 비용 계산
        
        Args:
            provider: 프로바이더명
            service: 서비스 타입
            tokens_used: 사용된 토큰 수
            
        Returns:
            계산된 비용 (USD)
        """
        try:
            cost_per_1k = self.PROVIDER_COSTS.get(provider, {}).get(service, 0.001)
            return (tokens_used / 1000) * cost_per_1k
        except Exception:
            return 0.0
    
    def get_current_usage(self, days: int = 30) -> Dict[str, Any]:
        """
        현재 사용량 통계 조회
        
        Args:
            days: 조회할 일수
            
        Returns:
            사용량 통계 데이터
        """
        db = self.db_manager.get_session()
        try:
            start_date = datetime.utcnow() - timedelta(days=days)
            
            # 전체 통계
            total_stats = db.query(
                func.sum(UsageLog.tokens_used).label('total_tokens'),
                func.count(UsageLog.id).label('total_requests'),
                func.sum(UsageLog.cost).label('total_cost')
            ).filter(
                UsageLog.timestamp >= start_date
            ).first()
            
            return {
                "total_tokens": total_stats.total_tokens or 0,
                "total_requests": total_stats.total_requests or 0,
                "total_cost": round(total_stats.total_cost or 0, 6),
                "period_start": start_date.isoformat(),
                "period_end": datetime.utcnow().isoformat()
            }
        finally:
            db.close()
    
    def get_daily_usage(self, days: int = 30) -> List[Dict[str, Any]]:
        """
        일별 사용량 통계 조회
        
        Args:
            days: 조회할 일수
            
        Returns:
            일별 사용량 데이터 리스트
        """
        db = self.db_manager.get_session()
        try:
            start_date = datetime.utcnow() - timedelta(days=days)
            
            # 일별 통계
            daily_stats = db.query(
                func.date(UsageLog.timestamp).label('date'),
                func.sum(UsageLog.tokens_used).label('total_tokens'),
                func.count(UsageLog.id).label('total_requests'),
                func.sum(UsageLog.cost).label('total_cost'),
                func.sum(func.case(
                    (UsageLog.service == 'llm', UsageLog.tokens_used),
                    else_=0
                )).label('llm_tokens'),
                func.sum(func.case(
                    (UsageLog.service == 'embedding', UsageLog.tokens_used),
                    else_=0
                )).label('embedding_tokens'),
                func.sum(func.case(
                    (UsageLog.service == 'llm', 1),
                    else_=0
                )).label('llm_requests'),
                func.sum(func.case(
                    (UsageLog.service == 'embedding', 1),
                    else_=0
                )).label('embedding_requests')
            ).filter(
                UsageLog.timestamp >= start_date
            ).group_by(
                func.date(UsageLog.timestamp)
            ).order_by(
                func.date(UsageLog.timestamp)
            ).all()
            
            return [
                {
                    "date": str(stat.date),
                    "total_tokens": stat.total_tokens or 0,
                    "total_requests": stat.total_requests or 0,
                    "total_cost": round(stat.total_cost or 0, 6),
                    "llm_tokens": stat.llm_tokens or 0,
                    "embedding_tokens": stat.embedding_tokens or 0,
                    "llm_requests": stat.llm_requests or 0,
                    "embedding_requests": stat.embedding_requests or 0
                }
                for stat in daily_stats
            ]
        finally:
            db.close()
    
    def get_provider_usage(self, days: int = 30) -> List[Dict[str, Any]]:
        """
        프로바이더별 사용량 통계 조회
        
        Args:
            days: 조회할 일수
            
        Returns:
            프로바이더별 사용량 데이터 리스트
        """
        db = self.db_manager.get_session()
        try:
            start_date = datetime.utcnow() - timedelta(days=days)
            
            # 프로바이더별 통계
            provider_stats = db.query(
                UsageLog.provider,
                func.sum(UsageLog.tokens_used).label('total_tokens'),
                func.count(UsageLog.id).label('total_requests'),
                func.sum(UsageLog.cost).label('total_cost')
            ).filter(
                UsageLog.timestamp >= start_date
            ).group_by(
                UsageLog.provider
            ).all()
            
            # 전체 합계
            total_cost = sum(stat.total_cost or 0 for stat in provider_stats)
            
            return [
                {
                    "provider": stat.provider,
                    "total_tokens": stat.total_tokens or 0,
                    "total_requests": stat.total_requests or 0,
                    "total_cost": round(stat.total_cost or 0, 6),
                    "percentage": round((stat.total_cost or 0) / total_cost * 100, 2) if total_cost > 0 else 0
                }
                for stat in provider_stats
            ]
        finally:
            db.close()
    
    def get_service_usage(self, days: int = 30) -> List[Dict[str, Any]]:
        """
        서비스별 사용량 통계 조회
        
        Args:
            days: 조회할 일수
            
        Returns:
            서비스별 사용량 데이터 리스트
        """
        db = self.db_manager.get_session()
        try:
            start_date = datetime.utcnow() - timedelta(days=days)
            
            # 서비스별 통계
            service_stats = db.query(
                UsageLog.service,
                func.sum(UsageLog.tokens_used).label('total_tokens'),
                func.count(UsageLog.id).label('total_requests'),
                func.sum(UsageLog.cost).label('total_cost')
            ).filter(
                UsageLog.timestamp >= start_date
            ).group_by(
                UsageLog.service
            ).all()
            
            # 전체 합계
            total_cost = sum(stat.total_cost or 0 for stat in service_stats)
            
            return [
                {
                    "service": stat.service,
                    "total_tokens": stat.total_tokens or 0,
                    "total_requests": stat.total_requests or 0,
                    "total_cost": round(stat.total_cost or 0, 6),
                    "percentage": round((stat.total_cost or 0) / total_cost * 100, 2) if total_cost > 0 else 0
                }
                for stat in service_stats
            ]
        finally:
            db.close()
    
    def get_cost_analysis(self, days: int = 30) -> Dict[str, Any]:
        """
        비용 분석 데이터 조회
        
        Args:
            days: 조회할 일수
            
        Returns:
            비용 분석 데이터
        """
        db = self.db_manager.get_session()
        try:
            start_date = datetime.utcnow() - timedelta(days=days)
            
            # 현재 기간 통계
            current_stats = db.query(
                func.sum(UsageLog.cost).label('total_cost'),
                func.sum(func.case(
                    (UsageLog.service == 'llm', UsageLog.cost),
                    else_=0
                )).label('llm_cost'),
                func.sum(func.case(
                    (UsageLog.service == 'embedding', UsageLog.cost),
                    else_=0
                )).label('embedding_cost')
            ).filter(
                UsageLog.timestamp >= start_date
            ).first()
            
            total_cost = current_stats.total_cost or 0
            llm_cost = current_stats.llm_cost or 0
            embedding_cost = current_stats.embedding_cost or 0
            
            # 일평균 비용
            daily_average = total_cost / days if days > 0 else 0
            
            # 월간 예상 비용
            projected_monthly = daily_average * 30
            
            return {
                "current_period": {
                    "total_cost": round(total_cost, 6),
                    "daily_average": round(daily_average, 6),
                    "projected_monthly": round(projected_monthly, 6)
                },
                "breakdown": {
                    "llm_cost": round(llm_cost, 6),
                    "embedding_cost": round(embedding_cost, 6),
                    "llm_percentage": round(llm_cost / total_cost * 100, 2) if total_cost > 0 else 0,
                    "embedding_percentage": round(embedding_cost / total_cost * 100, 2) if total_cost > 0 else 0
                },
                "trends": {
                    "cost_change_percentage": 0,  # 이전 기간과 비교 (향후 구현)
                    "usage_change_percentage": 0,  # 이전 기간과 비교 (향후 구현)
                    "period_comparison": f"Last {days} days"
                }
            }
        finally:
            db.close()


# 전역 사용량 추적기 인스턴스
usage_tracker = UsageTracker() 