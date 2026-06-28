FROM alpine:3.19 AS builder
RUN apk add --no-cache curl

FROM vikunja/vikunja:latest

# curl 실행 바이너리 주입
COPY --from=builder /usr/bin/curl /usr/bin/curl

# 동작에 핵심적으로 필요한 동적 링크 공유 라이브러리 일체 COPY
COPY --from=builder /lib/ld-musl-*.so.1 /lib/
COPY --from=builder /lib/libz.so.1 /lib/
COPY --from=builder /usr/lib/libcurl.so.4 /usr/lib/
COPY --from=builder /usr/lib/libssl.so.3 /usr/lib/
COPY --from=builder /usr/lib/libcrypto.so.3 /usr/lib/
COPY --from=builder /usr/lib/libnghttp2.so.14 /usr/lib/
COPY --from=builder /usr/lib/libbrotlidec.so.1 /usr/lib/
COPY --from=builder /usr/lib/libbrotlicommon.so.1 /usr/lib/

# 누락된 curl 의존 라이브러리 3종 추가 카피
COPY --from=builder /usr/lib/libcares.so.2 /usr/lib/
COPY --from=builder /usr/lib/libidn2.so.0 /usr/lib/
COPY --from=builder /usr/lib/libpsl.so.5 /usr/lib/

# 컨테이너 실행 사용자를 Vikunja 기본(1000)으로 원복
USER 1000
