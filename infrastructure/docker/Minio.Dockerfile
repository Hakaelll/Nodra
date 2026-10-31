# Upstream is archived. Optional local compatibility fixture, never a production default.
FROM golang:1.24-bookworm AS build
RUN go install github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/* && useradd -u 10001 -m minio
COPY --from=build /go/bin/minio /usr/local/bin/minio
RUN mkdir /data && chown minio:minio /data
USER minio
ENTRYPOINT ["minio"]
