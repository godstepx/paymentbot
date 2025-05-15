# Use the official Bun image as the base image
FROM oven/bun:1.0.0

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and bun.lock to the container
COPY package.json bun.lock ./

# Install dependencies using bun
RUN bun install

# Copy the rest of the application code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Start the application using bun
CMD ["bun", "index.ts"]
