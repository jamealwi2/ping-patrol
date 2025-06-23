# Use nginx alpine for a lightweight image
FROM nginx:alpine

# Copy static frontend files to the default nginx webroot directory
COPY index.html /usr/share/nginx/html/
COPY script.js /usr/share/nginx/html/
COPY style.css /usr/share/nginx/html/

# Nginx by default listens on port 80
EXPOSE 80

# Default command to start nginx
CMD ["nginx", "-g", "daemon off;"]
