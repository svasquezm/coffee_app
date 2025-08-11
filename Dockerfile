# Dockerfile para la API de Coffee
FROM node:18-alpine

# Carpeta de trabajo
WORKDIR /usr/src/app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el código de la aplicación
COPY . .

# Puerto expuesto (coincide con el PORT en .env)
EXPOSE 3000

# Variables de entorno por defecto (puedes sobreescribir en docker-compose)
ENV NODE_ENV=development

# Comando para arrancar la app
CMD ["npm", "start"]