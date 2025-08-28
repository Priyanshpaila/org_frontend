FROM node:18 AS build

ENV PORT=8080
ENV NODE_OPTIONS="--max-old-space-size=2048"
ENV VITE_API_URL=https://orgmatrixbe.rrispat.in

WORKDIR /app
COPY package.json /app/
COPY package-lock.json /app/

# Clean npm cache and force esbuild rebuild
RUN npm cache clean --force
RUN npm install --legacy-peer-deps
RUN npm rebuild esbuild

COPY . /app/

# Build the application
RUN npm run build

FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# Copy custom nginx.conf to replace default nginx.conf
COPY ./nginx.conf /etc/nginx/nginx.conf

EXPOSE ${PORT}

CMD ["nginx", "-g", "daemon off;"]


# docker build  --no-cache -t 192.168.13.72:5000/orgmatrix_fe .      
# docker run -d --name orgmatrix_fe -p 80:80 orgmatrix_fe_image

# docker tag orgmatrix_fe_image 192.168.13.72:5000/orgmatrix_fe
# docker push 192.168.13.72:5000/orgmatrix_fe
# docker pull 192.168.13.72:5000/orgmatrix_fe
# docker run -d --name orgmatrix_fe -p 8080:8080 192.168.13.72:5000/orgmatrix_fe


# docker pull 192.168.13.72:5000/rrcomplaint_frontend
# docker run -d --name rrcomplaint_frontend -p 8003:80 192.168.13.72:5000/rrcomplaint_frontend