FROM golang:alpine as build

RUN apk add --no-cache git

ADD . /go/src/app

WORKDIR /go/src/app

RUN go build -o "service" -buildvcs=false -tags musl ./

FROM alpine:3

RUN apk update \
	&& apk -U upgrade \
	&& apk add --no-cache ca-certificates bash \
	&& update-ca-certificates --fresh \
	&& rm -rf /var/cache/apk/*

# adds service user
RUN	addgroup service \
	&& adduser -S service -u 1000 -G service

USER service

COPY --from=build --chown=service:service /go/src/app/service /usr/local/bin/
RUN chmod +x /usr/local/bin/service

ENTRYPOINT [ "/usr/local/bin/service" ]