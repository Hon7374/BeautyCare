# BeautyCare Full Demo

## Má»¥c Ä‘Ã­ch

Script full demo trong thÆ° má»¥c `demo/` tá»±:

- dá»±ng MySQL demo riÃªng trong `demo/runtime/`
- import `database/beautycare.mysql.sql`
- khá»Ÿi Ä‘á»™ng backend Ä‘Ãºng kiáº¿n trÃºc repo
- má»Ÿ browser desktop tháº­t
- quay mÃ n hÃ¬nh THáº¬T cá»§a desktop báº±ng `ffmpeg gdigrab`
- tá»± thao tÃ¡c UI cho cÃ¡c luá»“ng public, auth, account, security, services, booking vÃ  admin
- lÆ°u video cuá»‘i vÃ o `demo/beautycare-full-demo.mkv`

## Dependency

- Windows
- Node.js
- Python 3
- MySQL Server 8.0 binaries táº¡i `C:\Program Files\MySQL\MySQL Server 8.0\bin\`
- Chrome hoáº·c Edge desktop
- `ffmpeg`

Náº¿u `ffmpeg` chÆ°a cÃ³, wrapper PowerShell sáº½ tá»± thá»­ cÃ i báº±ng `winget` hoáº·c `choco`.

## Cá»‘ng cá»¥ quay mÃ n hÃ¬nh tháº­t

Local recording tool Ä‘Æ°á»£c dÃ¹ng cho full demo:

- `ffmpeg` với `gdigrab` desktop capture

ÄÃ¢y lÃ  quay desktop tháº­t cá»§a mÃ¡y, khÃ´ng pháº£i Playwright video, trace hay chuá»—i screenshot.

## CÃ¡ch cháº¡y láº¡i

Tá»« root repo:

```powershell
powershell -ExecutionPolicy Bypass -File demo\run-full-demo.ps1
```

## File Ä‘áº§u ra

- Video cuá»‘i: `demo/beautycare-full-demo.mkv`
- Script cháº¡y láº¡i: `demo/run-full-demo.ps1`
- Orchestrator chÃ­nh: `demo/full_demo.py`
- Checklist: `demo/feature-checklist.md`
- Káº¿t quáº£ run gáº§n nháº¥t: `demo/demo-results.md`

## Pass / Fail / Skip

- Danh sÃ¡ch tính năng Ä‘Æ°á»£c nhắm tá»›i nÆ°á»›c Ä‘i trong `demo/feature-checklist.md`
- Káº¿t quáº£ pass/fail/skip cá»§a láº§n cháº¡y gáº§n nháº¥t Ä‘Æ°á»£c ghi vÃ o `demo/demo-results.md`

## Ghi chÃº

- Script khÃ´ng ghi Ä‘Ã¨ `backend/.env`; backend Ä‘Æ°á»£c cháº¡y vá»›i biáº¿n mÃ´i trÆ°á»ng override chá»‰ trong session demo.
- Má»—i láº§n cháº¡y script sáº½ dá»±ng láº¡i MySQL demo riÃªng Ä‘á»ƒ luá»“ng register / booking / email verify / 2FA luÃ´n á»•n Ä‘á»‹nh.
- Sau khi script thÃ nh cÃ´ng, wrapper sáº½ tá»± má»Ÿ video, README vÃ  file results trÃªn mÃ¡y.
