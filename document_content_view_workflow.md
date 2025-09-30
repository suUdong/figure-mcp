# 문서내용 출력화면 개발 워크플로우

## 1. 개요

본 워크플로우는 backend-office에서 문서내용을 볼 수 있는 화면 개발을 위한 전체 과정을 단계별로 정리한 것입니다. 기존 화면에서는 문서목록에서 내용을 볼 수 없어 어떤 내용인지 판단이 불가했던 문제를 해결하기 위해, 문서목록에 새로운 버튼을 추가하고 클릭 시 문서내용을 팝업으로 노출하는 기능을 구현합니다.

## 2. 영향도 분석 요약

### 2.1 영향 받는 주요 파일
- `figure-backend-office/app/documents/components/DocumentList.tsx` (기존 파일 수정)
- `figure-backend-office/app/documents/components/DocumentContentModal.tsx` (신규 파일 생성)
- `figure-backend-office/app/documents/api/document.ts` (기존 API 활용 또는 확장)

### 2.2 핵심 변경사항
- 문서목록 테이블에 "내용 보기" 버튼 추가
- 내용 보기 버튼 클릭 시 모달 팝업 표시 기능 구현
- 문서 내용을 가져오는 API 연동
- 팝업에 문서 내용 표시 및 닫기 기능 구현

## 3. 개발 워크플로우

### 3.1 준비 단계

1. **개발 환경 설정**
   ```bash
   cd figure-backend-office
   npm install
   ```

2. **기존 코드 분석**
   - 문서목록 컴포넌트 구조 파악
   - 기존 API 호출 방식 확인
   - 기존 모달 컴포넌트 유무 및 패턴 확인

### 3.2 구현 단계

1. **문서 내용 조회 API 확인/구현**
   - 기존 API에서 문서 내용을 제공하는지 확인
   - 필요시 API 엔드포인트 추가 또는 수정

2. **문서 내용 표시 모달 컴포넌트 생성**
   ```typescript
   // DocumentContentModal.tsx 생성
   import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography } from '@mui/material';
   
   interface DocumentContentModalProps {
     open: boolean;
     onClose: () => void;
     documentContent: string;
     documentTitle: string;
   }
   
   export function DocumentContentModal({ 
     open, 
     onClose, 
     documentContent, 
     documentTitle 
   }: DocumentContentModalProps) {
     return (
       <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
         <DialogTitle>{documentTitle}</DialogTitle>
         <DialogContent dividers>
           <Typography>
             {documentContent || '문서 내용을 불러올 수 없습니다.'}
           </Typography>
         </DialogContent>
         <DialogActions>
           <Button onClick={onClose}>닫기</Button>
         </DialogActions>
       </Dialog>
     );
   }
   ```

3. **문서목록 컴포넌트 수정**
   - "내용 보기" 버튼 추가
   - 클릭 이벤트 핸들러 및 모달 상태 관리 추가
   - API 호출 로직 연동

   ```typescript
   // DocumentList.tsx 수정
   import { useState } from 'react';
   import { DocumentContentModal } from './DocumentContentModal';
   import { fetchDocumentContent } from '../api/document';
   
   // 기존 DocumentList 컴포넌트 내부에 추가
   const [selectedDoc, setSelectedDoc] = useState(null);
   const [docContent, setDocContent] = useState('');
   const [isModalOpen, setIsModalOpen] = useState(false);
   const [isLoading, setIsLoading] = useState(false);
   
   const handleViewContent = async (docId) => {
     setIsLoading(true);
     try {
       const content = await fetchDocumentContent(docId);
       setDocContent(content);
       setSelectedDoc(documents.find(doc => doc.id === docId));
       setIsModalOpen(true);
     } catch (error) {
       console.error('Failed to load document content:', error);
       // 에러 처리
     } finally {
       setIsLoading(false);
     }
   };
   
   // 테이블 내 액션 컬럼에 버튼 추가
   <Button 
     variant="outlined" 
     size="small"
     onClick={() => handleViewContent(row.id)}
     disabled={isLoading}
   >
     내용 보기
   </Button>
   
   // 컴포넌트 반환부에 모달 추가
   {selectedDoc && (
     <DocumentContentModal
       open={isModalOpen}
       onClose={() => setIsModalOpen(false)}
       documentContent={docContent}
       documentTitle={selectedDoc.title}
     />
   )}
   ```

4. **API 함수 추가/확인**
   ```typescript
   // document.ts에 추가 또는 확인
   export async function fetchDocumentContent(docId: string): Promise<string> {
     const response = await fetch(`/api/documents/${docId}/content`);
     if (!response.ok) {
       throw new Error('Failed to fetch document content');
     }
     const data = await response.json();
     return data.content;
   }
   ```

### 3.3 테스트 단계

1. **단위 테스트**
   - 모달 컴포넌트 렌더링 테스트
   - 버튼 클릭 및 API 호출 테스트

2. **통합 테스트**
   - 문서목록에서 버튼 클릭 → 모달 표시 → 내용 확인 → 닫기 워크플로우 테스트
   - 에러 상황 처리 테스트

3. **UI/UX 테스트**
   - 디자인 일관성 확인
   - 모바일 및 다양한 화면 크기에서의 반응형 테스트
   - 접근성 테스트 (키보드 탐색 등)

### 3.4 배포 및 모니터링

1. **코드 리뷰 및 품질 확인**
   - PR 제출 및 코드 리뷰 진행
   - 코드 품질 및 성능 검토

2. **배포 및 릴리스**
   - 스테이징 환경 배포 및 검증
   - 프로덕션 환경 배포

3. **모니터링**
   - 사용자 피드백 수집
   - 에러 로그 모니터링
   - 성능 모니터링

## 4. 기술적 고려사항

### 4.1 성능 최적화
- 대용량 문서 처리를 위한 청크 로딩 고려
- 문서 캐싱 전략 검토

### 4.2 보안 고려사항
- XSS 방지 (문서 내용 렌더링 시)
- 권한 검증 확인

### 4.3 확장성
- 향후 문서 내용 검색, 하이라이팅 기능 고려
- 문서 형식(마크다운, HTML 등) 지원 확장성 고려

## 5. 일정 계획

| 단계 | 작업 | 예상 소요 시간 |
|------|------|--------------|
| 1 | 기존 코드 분석 및 설계 | 1일 |
| 2 | API 연동 및 모달 컴포넌트 구현 | 2일 |
| 3 | 문서목록 컴포넌트 수정 | 1일 |
| 4 | 테스트 및 디버깅 | 2일 |
| 5 | 코드 리뷰 및 수정 | 1일 |
| 6 | 배포 및 검증 | 1일 |

**총 예상 개발 기간: 8일**

## 6. 결론

이 워크플로우는 backend-office에서 문서내용을 볼 수 있는 화면 개발을 위한 체계적인 접근 방법을 제시합니다. 기능 구현 후 사용자들은 문서목록에서 직접 문서 내용을 확인할 수 있게 되어, 업무 효율성이 향상될 것으로 기대됩니다.

개발자는 이 워크플로우를 따라 단계별로 구현하되, 프로젝트의 특성과 기존 코드 패턴에 맞게 적절히 조정하여 적용하시기 바랍니다.
