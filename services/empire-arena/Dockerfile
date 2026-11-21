# BUKLOD Empire Arena — isolated server infrastructure only (NOT a second app).
# Build from the repository root:
#   docker build -f services/empire-arena/Dockerfile -t buklod-arena-staging:dev .
# Run only with a staging-only Supabase branch, TLS WSS proxy and server-side secrets.
FROM node:22-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8797
WORKDIR /opt/buklod
COPY services/empire-arena/package.json services/empire-arena/package-lock.json ./services/empire-arena/
RUN npm ci --prefix services/empire-arena --omit=dev --ignore-scripts --no-audit --no-fund
COPY services/empire-arena/*.mjs ./services/empire-arena/
COPY experiments/empire-arena-v2/*.mjs ./experiments/empire-arena-v2/
USER node
EXPOSE 8797
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/readyz',{signal:AbortSignal.timeout(3000)}).then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"
CMD ["node","services/empire-arena/server.mjs"]
