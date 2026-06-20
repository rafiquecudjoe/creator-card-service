# Creator Card Microservice — production image
FROM node:20-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# Copy the whole project first: the @app-core/* and @app/* packages are local
# `file:` dependencies, so their source directories must be present before
# `npm install` can resolve the links.
COPY . .

# Install production dependencies only.
# --ignore-scripts skips the husky "prepare" hook (there is no .git in the image)
# and native add-on rebuilds (e.g. bcrypt) that this service never loads at runtime.
RUN npm install --omit=dev --ignore-scripts \
  && npm cache clean --force

# Run as the unprivileged user that ships with the node image.
RUN chown -R node:node /app
USER node

# The server reads PORT from the environment (Render/Heroku inject it) and
# falls back to 8811. EXPOSE is documentation only.
EXPOSE 8811

# Boot loads .env / platform env, connects to MONGODB_URI, then starts the server.
CMD ["node", "bootstrap.js"]
