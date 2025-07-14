/**
 * Figure-MCP 관리자 대시보드 JavaScript
 */

class AdminDashboard {
    constructor() {
        this.ws = null;
        this.charts = {};
        this.refreshInterval = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadInitialData();
        this.setupCharts();
        this.connectWebSocket();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        // 새로고침 버튼
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshData();
        });

        // 상태 필터
        document.getElementById('status-filter').addEventListener('change', (e) => {
            this.filterJobs(e.target.value);
        });
    }

    async loadInitialData() {
        try {
            const response = await fetch('/admin/stats');
            const data = await response.json();
            
            this.updateMetricsCards(data.system_metrics);
            this.updateJobsTable(data.recent_jobs);
            this.updateCharts(data);
        } catch (error) {
            console.error('데이터 로드 실패:', error);
            this.showNotification('데이터를 불러오는데 실패했습니다', 'error');
        }
    }

    updateMetricsCards(metrics) {
        document.getElementById('active-jobs').textContent = metrics.active_jobs;
        document.getElementById('cpu-usage').textContent = `${metrics.cpu_usage.toFixed(1)}%`;
        document.getElementById('memory-usage').textContent = `${metrics.memory_usage.toFixed(1)}%`;
        document.getElementById('completed-today').textContent = metrics.completed_jobs_today;
    }

    updateJobsTable(jobs) {
        const tableBody = document.getElementById('jobs-table-body');
        tableBody.innerHTML = '';

        jobs.forEach(job => {
            const row = this.createJobRow(job);
            tableBody.appendChild(row);
        });
    }

    createJobRow(job) {
        const row = document.createElement('tr');
        row.className = 'border-b hover:bg-gray-50';
        
        const statusClass = this.getStatusClass(job.status);
        const progressBar = this.createProgressBar(job.progress);
        const duration = this.calculateDuration(job.started_at, job.completed_at);
        
        row.innerHTML = `
            <td class="py-3">
                <span class="font-mono text-sm">${job.id.substring(0, 8)}</span>
            </td>
            <td class="py-3">
                <span class="px-2 py-1 text-xs rounded bg-gray-100">${this.formatJobType(job.type)}</span>
            </td>
            <td class="py-3">
                <span class="px-2 py-1 text-xs rounded ${statusClass}">${this.formatStatus(job.status)}</span>
            </td>
            <td class="py-3">
                ${progressBar}
            </td>
            <td class="py-3">
                <span class="text-sm text-gray-600">${job.message || '-'}</span>
            </td>
            <td class="py-3">
                <span class="text-sm text-gray-500">${this.formatDateTime(job.created_at)}</span>
            </td>
            <td class="py-3">
                <span class="text-sm text-gray-500">${duration}</span>
            </td>
        `;
        
        return row;
    }

    getStatusClass(status) {
        const classes = {
            'pending': 'bg-yellow-100 text-yellow-800',
            'processing': 'bg-blue-100 text-blue-800',
            'completed': 'bg-green-100 text-green-800',
            'failed': 'bg-red-100 text-red-800',
            'cancelled': 'bg-gray-100 text-gray-800'
        };
        return classes[status] || 'bg-gray-100 text-gray-800';
    }

    formatStatus(status) {
        const statusMap = {
            'pending': '대기중',
            'processing': '처리중',
            'completed': '완료',
            'failed': '실패',
            'cancelled': '취소'
        };
        return statusMap[status] || status;
    }

    formatJobType(type) {
        const typeMap = {
            'document_upload': '문서 업로드',
            'vectorization': '벡터화',
            'rag_query': 'RAG 쿼리',
            'design_generation': '디자인 생성'
        };
        return typeMap[type] || type;
    }

    createProgressBar(progress) {
        return `
            <div class="flex items-center space-x-2">
                <div class="w-20 bg-gray-200 rounded-full h-2">
                    <div class="bg-blue-600 h-2 rounded-full" style="width: ${progress}%"></div>
                </div>
                <span class="text-xs text-gray-600">${progress.toFixed(1)}%</span>
            </div>
        `;
    }

    calculateDuration(startedAt, completedAt) {
        if (!startedAt) return '-';
        
        const start = new Date(startedAt);
        const end = completedAt ? new Date(completedAt) : new Date();
        const duration = Math.floor((end - start) / 1000);
        
        if (duration < 60) return `${duration}초`;
        if (duration < 3600) return `${Math.floor(duration / 60)}분`;
        return `${Math.floor(duration / 3600)}시간`;
    }

    formatDateTime(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    setupCharts() {
        this.setupJobStatusChart();
        this.setupSystemUsageChart();
    }

    setupJobStatusChart() {
        const ctx = document.getElementById('jobStatusChart').getContext('2d');
        this.charts.jobStatus = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['대기중', '처리중', '완료', '실패'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: [
                        '#FEF3C7', // yellow
                        '#BFDBFE', // blue
                        '#D1FAE5', // green
                        '#FEE2E2'  // red
                    ],
                    borderColor: [
                        '#F59E0B',
                        '#3B82F6',
                        '#10B981',
                        '#EF4444'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    setupSystemUsageChart() {
        const ctx = document.getElementById('systemUsageChart').getContext('2d');
        this.charts.systemUsage = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['CPU', 'Memory', 'Disk'],
                datasets: [{
                    label: '사용률 (%)',
                    data: [0, 0, 0],
                    backgroundColor: [
                        '#10B981',
                        '#F59E0B',
                        '#8B5CF6'
                    ],
                    borderColor: [
                        '#059669',
                        '#D97706',
                        '#7C3AED'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    updateCharts(data) {
        // Job Status Chart 업데이트
        const statusCounts = this.calculateStatusCounts(data.recent_jobs);
        this.charts.jobStatus.data.datasets[0].data = [
            statusCounts.pending || 0,
            statusCounts.processing || 0,
            statusCounts.completed || 0,
            statusCounts.failed || 0
        ];
        this.charts.jobStatus.update();

        // System Usage Chart 업데이트
        const metrics = data.system_metrics;
        this.charts.systemUsage.data.datasets[0].data = [
            metrics.cpu_usage,
            metrics.memory_usage,
            metrics.disk_usage
        ];
        this.charts.systemUsage.update();
    }

    calculateStatusCounts(jobs) {
        const counts = {};
        jobs.forEach(job => {
            counts[job.status] = (counts[job.status] || 0) + 1;
        });
        return counts;
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/admin/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'metrics_update') {
                this.handleRealtimeUpdate(data);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket 연결이 종료되었습니다. 5초 후 재연결을 시도합니다.');
            setTimeout(() => this.connectWebSocket(), 5000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket 오류:', error);
        };
    }

    handleRealtimeUpdate(data) {
        this.updateMetricsCards(data.metrics);
        
        // 활성 작업만 업데이트 (전체 테이블은 새로고침 시에만)
        const activeJobsCount = data.active_jobs.length;
        document.getElementById('active-jobs').textContent = activeJobsCount;
    }

    async filterJobs(status) {
        try {
            const url = status ? `/admin/jobs?status=${status}` : '/admin/jobs';
            const response = await fetch(url);
            const jobs = await response.json();
            
            this.updateJobsTable(jobs);
        } catch (error) {
            console.error('작업 필터링 실패:', error);
            this.showNotification('작업 목록을 불러오는데 실패했습니다', 'error');
        }
    }

    async refreshData() {
        const button = document.getElementById('refresh-btn');
        const icon = button.querySelector('i');
        
        // 로딩 애니메이션
        icon.classList.add('fa-spin');
        button.disabled = true;
        
        try {
            await this.loadInitialData();
            this.showNotification('데이터가 새로고침되었습니다', 'success');
        } catch (error) {
            this.showNotification('새로고침에 실패했습니다', 'error');
        } finally {
            icon.classList.remove('fa-spin');
            button.disabled = false;
        }
    }

    startAutoRefresh() {
        // 30초마다 자동 새로고침
        this.refreshInterval = setInterval(() => {
            this.loadInitialData();
        }, 30000);
    }

    showNotification(message, type = 'info') {
        // 간단한 토스트 알림 구현
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg z-50 ${
            type === 'success' ? 'bg-green-500 text-white' :
            type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    destroy() {
        if (this.ws) {
            this.ws.close();
        }
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        Object.values(this.charts).forEach(chart => chart.destroy());
    }
}

// 페이지 로드 시 대시보드 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.adminDashboard = new AdminDashboard();
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    if (window.adminDashboard) {
        window.adminDashboard.destroy();
    }
}); 