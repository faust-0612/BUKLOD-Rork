FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod main.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /gateway .
FROM alpine:3.20
RUN adduser -D -u 10001 app
USER app
COPY --from=build /gateway /gateway
EXPOSE 8089
ENTRYPOINT ["/gateway"]
