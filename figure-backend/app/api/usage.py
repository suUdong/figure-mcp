"""
사용량 추적 API 엔드포인트
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional

from app.services.usage.tracker import usage_tracker

router = APIRouter(prefix="/usage", tags=["usage"])


@router.get("/current")
async def get_current_usage(
    days: int = Query(default=30, ge=1, le=365, description="조회할 일수")
) -> Dict[str, Any]:
    """
    현재 사용량 통계 조회
    
    Args:
        days: 조회할 일수 (1-365)
        
    Returns:
        현재 사용량 통계
    """
    try:
        usage_stats = usage_tracker.get_current_usage(days=days)
        return {
            "success": True,
            "data": usage_stats,
            "message": f"최근 {days}일 사용량 통계 조회 완료"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"사용량 통계 조회 실패: {str(e)}"
        )


@router.get("/daily")
async def get_daily_usage(
    days: int = Query(default=30, ge=1, le=365, description="조회할 일수")
) -> Dict[str, Any]:
    """
    일별 사용량 통계 조회
    
    Args:
        days: 조회할 일수 (1-365)
        
    Returns:
        일별 사용량 통계 리스트
    """
    try:
        daily_stats = usage_tracker.get_daily_usage(days=days)
        return {
            "success": True,
            "data": daily_stats,
            "message": f"최근 {days}일 일별 사용량 통계 조회 완료"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"일별 사용량 통계 조회 실패: {str(e)}"
        )


@router.get("/providers")
async def get_provider_usage(
    days: int = Query(default=30, ge=1, le=365, description="조회할 일수")
) -> Dict[str, Any]:
    """
    프로바이더별 사용량 통계 조회
    
    Args:
        days: 조회할 일수 (1-365)
        
    Returns:
        프로바이더별 사용량 통계 리스트
    """
    try:
        provider_stats = usage_tracker.get_provider_usage(days=days)
        return {
            "success": True,
            "data": provider_stats,
            "message": f"최근 {days}일 프로바이더별 사용량 통계 조회 완료"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"프로바이더별 사용량 통계 조회 실패: {str(e)}"
        )


@router.get("/services")
async def get_service_usage(
    days: int = Query(default=30, ge=1, le=365, description="조회할 일수")
) -> Dict[str, Any]:
    """
    서비스별 사용량 통계 조회
    
    Args:
        days: 조회할 일수 (1-365)
        
    Returns:
        서비스별 사용량 통계 리스트
    """
    try:
        service_stats = usage_tracker.get_service_usage(days=days)
        return {
            "success": True,
            "data": service_stats,
            "message": f"최근 {days}일 서비스별 사용량 통계 조회 완료"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"서비스별 사용량 통계 조회 실패: {str(e)}"
        )


@router.get("/cost-analysis")
async def get_cost_analysis(
    days: int = Query(default=30, ge=1, le=365, description="조회할 일수")
) -> Dict[str, Any]:
    """
    비용 분석 데이터 조회
    
    Args:
        days: 조회할 일수 (1-365)
        
    Returns:
        비용 분석 데이터
    """
    try:
        cost_analysis = usage_tracker.get_cost_analysis(days=days)
        return {
            "success": True,
            "data": cost_analysis,
            "message": f"최근 {days}일 비용 분석 데이터 조회 완료"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"비용 분석 데이터 조회 실패: {str(e)}"
        )


@router.get("/summary")
async def get_usage_summary(
    days: int = Query(default=30, ge=1, le=365, description="조회할 일수")
) -> Dict[str, Any]:
    """
    사용량 요약 정보 조회 (모든 통계를 한 번에)
    
    Args:
        days: 조회할 일수 (1-365)
        
    Returns:
        전체 사용량 요약 정보
    """
    try:
        # 모든 통계 데이터를 병렬로 조회
        current_usage = usage_tracker.get_current_usage(days=days)
        provider_usage = usage_tracker.get_provider_usage(days=days)
        service_usage = usage_tracker.get_service_usage(days=days)
        cost_analysis = usage_tracker.get_cost_analysis(days=days)
        
        return {
            "success": True,
            "data": {
                "current_usage": current_usage,
                "provider_usage": provider_usage,
                "service_usage": service_usage,
                "cost_analysis": cost_analysis,
                "period": f"최근 {days}일"
            },
            "message": f"최근 {days}일 사용량 요약 정보 조회 완료"
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"사용량 요약 정보 조회 실패: {str(e)}"
        ) 