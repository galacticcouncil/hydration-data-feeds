import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Counter, Histogram, Gauge, register } from 'prom-client';
import { Request, Response } from 'express';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly httpRequestsInProgress: Gauge<string>;
  private readonly httpResponseSize: Histogram<string>;

  constructor() {
    // Get or create metrics (singleton pattern)
    this.httpRequestsTotal = this.getOrCreateCounter(
      'http_requests_total',
      'Total number of HTTP requests',
      ['method', 'route', 'status_code']
    );

    this.httpRequestDuration = this.getOrCreateHistogram(
      'http_request_duration_seconds',
      'Duration of HTTP requests in seconds',
      ['method', 'route', 'status_code'],
      [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
    );

    this.httpRequestsInProgress = this.getOrCreateGauge(
      'http_requests_in_progress',
      'Number of HTTP requests currently in progress',
      ['method', 'route']
    );

    this.httpResponseSize = this.getOrCreateHistogram(
      'http_response_size_bytes',
      'Size of HTTP responses in bytes',
      ['method', 'route', 'status_code'],
      [100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000]
    );
  }

  private getOrCreateCounter(
    name: string,
    help: string,
    labelNames: string[]
  ): Counter<string> {
    const existing = register.getSingleMetric(name);
    if (existing) {
      return existing as Counter<string>;
    }
    return new Counter({
      name,
      help,
      labelNames,
      registers: [register],
    });
  }

  private getOrCreateHistogram(
    name: string,
    help: string,
    labelNames: string[],
    buckets: number[]
  ): Histogram<string> {
    const existing = register.getSingleMetric(name);
    if (existing) {
      return existing as Histogram<string>;
    }
    return new Histogram({
      name,
      help,
      labelNames,
      buckets,
      registers: [register],
    });
  }

  private getOrCreateGauge(
    name: string,
    help: string,
    labelNames: string[]
  ): Gauge<string> {
    const existing = register.getSingleMetric(name);
    if (existing) {
      return existing as Gauge<string>;
    }
    return new Gauge({
      name,
      help,
      labelNames,
      registers: [register],
    });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const { method } = request;
    const route = this.getRoute(request);

    // Skip metrics endpoint to avoid self-monitoring
    if (route === '/metrics') {
      return next.handle();
    }

    // Increment in-progress gauge
    this.httpRequestsInProgress.inc({ method, route });

    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (data) => {
          this.recordMetrics(method, route, response.statusCode, startTime, data);
        },
        error: (error) => {
          const statusCode = error.status || 500;
          this.recordMetrics(method, route, statusCode, startTime, null);
        },
      }),
    );
  }

  private recordMetrics(
    method: string,
    route: string,
    statusCode: number,
    startTime: number,
    data: any,
  ): void {
    const duration = (Date.now() - startTime) / 1000;
    const labels = { method, route, status_code: statusCode.toString() };

    // Record metrics
    this.httpRequestsTotal.inc(labels);
    this.httpRequestDuration.observe(labels, duration);
    this.httpRequestsInProgress.dec({ method, route });

    // Try to estimate response size
    if (data) {
      try {
        const responseSize = JSON.stringify(data).length;
        this.httpResponseSize.observe(labels, responseSize);
      } catch {
        // If we can't stringify, skip response size metric
      }
    }
  }

  private getRoute(request: Request): string {
    // Try to get the route from the request
    // Use the base path if available, otherwise use the path
    const route = (request as any).route?.path || request.path;
    return route;
  }
}
