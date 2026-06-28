FROM vikunja/vikunja:latest AS official

FROM alpine:3.19

# Install curl, bash, sqlite, ca-certificates, and tzdata
RUN apk add --no-cache curl bash sqlite ca-certificates tzdata

# Create the workdir
WORKDIR /app/vikunja

# Copy the binary and files from the official image
COPY --from=official /app/vikunja /app/vikunja
COPY --from=official /etc/ssl/certs /etc/ssl/certs

# Set up user and group matching UID 1000
RUN addgroup -g 1000 vikunja && adduser -u 1000 -G vikunja -D vikunja
USER 1000

# Set environment variables
ENV VIKUNJA_SERVICE_ROOTPATH=/app/vikunja/
ENV VIKUNJA_DATABASE_PATH=/db/vikunja.db

ENTRYPOINT [ "/app/vikunja/vikunja" ]
EXPOSE 3456

