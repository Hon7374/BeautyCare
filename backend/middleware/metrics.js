const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestDurationMs = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration of HTTP requests in ms',
  labelNames: ['method', 'route', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
});
register.registerMetric(httpRequestDurationMs);

function metricsMiddleware(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    // Use originalUrl without query to reduce cardinality
    const route = (req.baseUrl + (req.route?.path || req.path || '')).split('?')[0];
    const duration = Date.now() - start;
    httpRequestDurationMs
      .labels(req.method, route || req.originalUrl.split('?')[0], String(res.statusCode))
      .observe(duration);
  });
  next();
}

async function metricsHandler(req, res) {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}

module.exports = { metricsMiddleware, metricsHandler };
