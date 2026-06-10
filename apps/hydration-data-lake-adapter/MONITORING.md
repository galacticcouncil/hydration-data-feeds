# Prometheus Monitoring and Health Checks

This application includes comprehensive Prometheus monitoring and health check endpoints for production deployments.

## Endpoints

### Prometheus Metrics

**Endpoint:** `/metrics`

Exposes Prometheus metrics in the standard format that can be scraped by Prometheus.

**Metrics Collected:**

1. **Default Node.js Metrics** (automatically collected):
   - `process_cpu_user_seconds_total` - Process CPU usage
   - `process_cpu_system_seconds_total` - System CPU usage
   - `process_resident_memory_bytes` - Resident memory size
   - `process_heap_bytes` - Process heap size
   - `nodejs_eventloop_lag_seconds` - Event loop lag
   - `nodejs_active_handles_total` - Active handles
   - `nodejs_active_requests_total` - Active requests
   - And many more...

2. **Custom API Metrics**:
   - `http_requests_total{method, route, status_code}` - Counter for total HTTP requests
   - `http_request_duration_seconds{method, route, status_code}` - Histogram of request durations
   - `http_requests_in_progress{method, route}` - Gauge for current requests in progress
   - `http_response_size_bytes{method, route, status_code}` - Histogram of response sizes

**Example:**
```bash
curl http://localhost:8088/metrics
```

### Health Check Endpoints

#### 1. Main Health Check

**Endpoint:** `/health`

Returns comprehensive health status including memory and disk usage.

**Response (healthy):**
```json
{
  "status": "ok",
  "info": {
    "memory_heap": {
      "status": "up"
    },
    "memory_rss": {
      "status": "up"
    },
    "storage": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "memory_heap": {
      "status": "up"
    },
    "memory_rss": {
      "status": "up"
    },
    "storage": {
      "status": "up"
    }
  }
}
```

**Status Codes:**
- `200` - Application is healthy
- `503` - Application is unhealthy

#### 2. Liveness Probe

**Endpoint:** `/health/liveness`

Simple endpoint to check if the application is alive and running. Use this for Kubernetes/Docker liveness probes.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-10-13T11:00:00.000Z"
}
```

**Status Codes:**
- `200` - Application is alive

#### 3. Readiness Probe

**Endpoint:** `/health/readiness`

Checks if the application is ready to accept traffic. Use this for Kubernetes/Docker readiness probes.

**Response (ready):**
```json
{
  "status": "ok",
  "info": {
    "memory_heap": {
      "status": "up"
    }
  },
  "error": {},
  "details": {
    "memory_heap": {
      "status": "up"
    }
  }
}
```

**Status Codes:**
- `200` - Application is ready
- `503` - Application is not ready

## Docker Swarm Configuration

The Docker stack file includes health check configuration:

```yaml
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8088/health/liveness"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

## Prometheus Configuration

To scrape metrics from this application, add the following to your Prometheus configuration:

```yaml
scrape_configs:
  - job_name: 'hydration-data-lake-adapter'
    static_configs:
      - targets: ['adapters.kril.hydration.cloud']
    metrics_path: '/metrics'
    scheme: 'https'
    scrape_interval: 15s
```

## Metrics Examples

### Track API Request Rate

```promql
rate(http_requests_total[5m])
```

### Track API Error Rate

```promql
rate(http_requests_total{status_code=~"5.."}[5m])
```

### Track 95th Percentile Response Time

```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### Track Memory Usage

```promql
process_resident_memory_bytes / 1024 / 1024
```

## Grafana Dashboard

You can create a Grafana dashboard using these metrics. Key panels to include:

1. Request rate by endpoint
2. Error rate
3. Response time percentiles (p50, p95, p99)
4. Memory usage
5. CPU usage
6. Active requests
7. Response sizes

## Alerts

Example Prometheus alerting rules:

```yaml
groups:
  - name: hydration-adapter-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} requests/second"

      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes > 250 * 1024 * 1024
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value | humanize }}B"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time"
          description: "95th percentile response time is {{ $value }}s"
```

## Testing Locally

To test the monitoring endpoints locally:

1. Start the application:
```bash
npm run start:dev
```

2. Make some API requests:
```bash
curl http://localhost:8088/api/v1/your-endpoint
```

3. Check metrics:
```bash
curl http://localhost:8088/metrics
```

4. Check health:
```bash
curl http://localhost:8088/health
curl http://localhost:8088/health/liveness
curl http://localhost:8088/health/readiness
```
