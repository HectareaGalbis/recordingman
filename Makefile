.PHONY: help install dev dev-app build build-web build-android build-desktop typecheck android apk desktop dist-desktop deploy deploy-preview clean

help:
	@echo "make install         Instala dependencias"
	@echo "make dev             Servidor de desarrollo (web)"
	@echo "make dev-app         Servidor de desarrollo (modo escritorio)"
	@echo "make build           Compila web, Android y escritorio"
	@echo "make build-web       Compila la web en dist/web"
	@echo "make build-android   Compila y sincroniza Android"
	@echo "make build-desktop   Compila escritorio en dist/desktop"
	@echo "make typecheck       Comprueba tipos"
	@echo "make android         Compila y abre Android Studio"
	@echo "make apk             Genera el APK de depuración"
	@echo "make desktop         Compila y ejecuta con Electron"
	@echo "make dist-desktop    Empaqueta escritorio en release/"
	@echo "make deploy          Compila la web y la publica en Netlify (producción)"
	@echo "make deploy-preview  Compila la web y la publica en una URL de prueba"
	@echo "make clean           Borra dist/ y release/"

install:
	npm install

dev:
	npm run dev

dev-app:
	npm run dev:app

build: build-web build-android build-desktop

build-web:
	npm run build:web

build-android:
	npm run build:android

build-desktop:
	npm run build:desktop

typecheck:
	npm run typecheck

android:
	npm run android

apk:
	npm run apk

desktop:
	npm run desktop

dist-desktop:
	npm run dist:desktop

deploy: build-web
	npx netlify-cli deploy --prod --dir=dist/web

deploy-preview: build-web
	npx netlify-cli deploy --dir=dist/web

clean:
	rm -rf dist release
