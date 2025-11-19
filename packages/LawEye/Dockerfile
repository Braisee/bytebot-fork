# Base image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy app source
COPY ./shared ./shared
COPY ./LawEye/ ./LawEye/

WORKDIR /app/LawEye

# Install dependencies
RUN npm install

# Build the application
RUN npm run build

# Run the application
CMD ["npm", "run", "start:prod"]

