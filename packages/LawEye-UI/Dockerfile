# Base image
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy app source
COPY ./shared ./shared
COPY ./LawEye-UI/ ./LawEye-UI/

WORKDIR /app/LawEye-UI

# Install dependencies
RUN npm install

# Build the application
RUN npm run build

# Expose port
EXPOSE 9993

# Run the application
CMD ["npm", "start"]

