# TESTING & SECURITY SCANS

## Backend
Trong thư mục `backend/`:

### 1) Cài dependency
```bash
npm install
```

### 2) Lint
```bash
npm run lint
```

### 3) Smoke tests
```bash
npm test
```

### 4) Dependency audit
```bash
npm run audit
```

> Khi làm báo cáo, bạn có thể chụp kết quả `npm run audit` (mức High) và ghi nhận “hạn chế/khuyến nghị” nếu còn cảnh báo.
