# Stage 1: Build the Go binary
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy go.mod and go.sum files to download dependencies
COPY go.mod ./
# COPY go.sum ./ # Only if go.sum exists; go mod tidy will create/update it
RUN go mod download
RUN go mod tidy # Ensure go.sum is up to date

# Copy the source code
COPY . .

# Build the Go application
# CGO_ENABLED=0 for a statically linked binary (recommended for alpine/distroless)
# -ldflags="-w -s" for smaller binary size (strips debug info)
RUN CGO_ENABLED=0 GOOS=linux go build -a -ldflags="-w -s" -o tester-agent .

# Stage 2: Create the final minimal image
FROM alpine:latest
# FROM gcr.io/distroless/static-debian11 # Alternative minimal image

WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /app/tester-agent .

# Set the entrypoint for the container
ENTRYPOINT ["./tester-agent"]

# Default command (can be overridden, but --destinations will usually be provided)
# CMD ["--destinations", "google.com:443,http://example.com"]
