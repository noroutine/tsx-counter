// instead of --loader ./https-loader.mjs
// use `register()`:
// --import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("%40node-loader/http", pathToFileURL("./"));'

import { register } from "node:module";
import { pathToFileURL } from "node:url";
register("./https-loader.mjs", pathToFileURL("./"));

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import morgan from 'morgan';
import { glob } from 'glob';
import path from 'path';

import { configDotenv } from 'dotenv';
import { assert } from "node:console";
configDotenv({ path: ['.env', '.env.local'] });

const app = express();

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

var fnRoutes = []

var unlessFunction = function (middleware) {
    return function (req, res, next) {
        if (fnRoutes.includes(req.path)) {
            return next();
        } else {
            return middleware(req, res, next);
        }
    };
};

const yes = /^(1|true|yes|on)$/i;

const FALLBACK_UPSTREAM = process.env.FALLBACK_UPSTREAM || null;
const FALLBACK_UPSTREAM_INDEX_PATH_REWRITE = yes.test(process.env.FALLBACK_UPSTREAM_INDEX_PATH_REWRITE) ? { '/$': '/index.html' } : undefined;

if (FALLBACK_UPSTREAM) {
    console.log(`Using fallback upstream: ${FALLBACK_UPSTREAM}, index path rewrite: ${FALLBACK_UPSTREAM_INDEX_PATH_REWRITE ? 'enabled' : 'disabled'}`);

    app.use(unlessFunction(
        createProxyMiddleware(
            {
                target: process.env.FALLBACK_UPSTREAM,
                changeOrigin: true,
                pathRewrite: FALLBACK_UPSTREAM_INDEX_PATH_REWRITE
            }
        )
    ));
}

const port = process.env.PORT || 3000;

async function loadRoutesFromLocation(app, location, at, routeMapper) {
    console.log(`Importing ${location}`);
    var mod = await import(location)
    Object.entries(mod).forEach(([key, value]) => {
        console.log(`  ...checking ${key} [${typeof value}]`);
        if (typeof value === 'function') {
            // construct the route to function
            var route = `${at}${routeMapper(location, key)}`

            // hack // to /
            route = route.replace(/\/+/, '/');

            app.all(route, value);

            fnRoutes.push(route);
            console.log(`  ✅ installed ${key}@${location} as ${route}`);
        } else {
            console.log(`     ignored ${key} [${typeof value}]`);
        }
    });
}

function routeMapperFn (location, key) {
    // hack https://raw.githubusercontent.com/noroutine/fn/master to ./
    var here = location.replace(/^https:\/\/raw.githubusercontent.com\/noroutine\/fn\/master/, '.');
    
    var route = `/${path.dirname(here)}/${key}`

    // hack /./ to /
    route = route.replace(/\/\.\//, '/');

    // hack // to /
    route = route.replace(/\/+/, '/');

    // handle main and index functino specially
    if (key == "main" || key == "index") {
        route = route.replace(/\/(main|index)$/, '/');
    }

    return route;
}

// Some testing of routeMapperFn
assert(routeMapperFn('./api/a/fn.js', 'main') === '/api/a/', 'routeMapperFn failed');
assert(routeMapperFn('./api/b/fn.js', 'index') === '/api/b/', 'routeMapperFn failed');
assert(routeMapperFn('./api/index.js', 'index') === '/api/', 'routeMapperFn failed');
assert(routeMapperFn('./api/fn.js', 'main') === '/api/', 'routeMapperFn failed');
assert(routeMapperFn('./api/nofn.js', 'fn1') === '/api/fn1', 'routeMapperFn failed');
assert(routeMapperFn('./api/a/fn.js', 'fn1') === '/api/a/fn1', 'routeMapperFn failed');
assert(routeMapperFn('./api/b/fn.js', 'fn1') === '/api/b/fn1', 'routeMapperFn failed');
assert(routeMapperFn('./api/index.js', 'fn1') === '/api/fn1', 'routeMapperFn failed');
assert(routeMapperFn('./api/fn.js', 'fn1') === '/api/fn1', 'routeMapperFn failed');
assert(routeMapperFn('./api/nofn.js', 'fn1') === '/api/fn1', 'routeMapperFn failed');

assert(routeMapperFn('/api/a/fn.js', 'main') === '/api/a/', 'routeMapperFn failed');
assert(routeMapperFn('/api/b/fn.js', 'index') === '/api/b/', 'routeMapperFn failed');
assert(routeMapperFn('/api/index.js', 'index') === '/api/', 'routeMapperFn failed');
assert(routeMapperFn('/api/fn.js', 'main') === '/api/', 'routeMapperFn failed');
assert(routeMapperFn('/api/nofn.js', 'fn1') === '/api/fn1', 'routeMapperFn failed');
assert(routeMapperFn('/api/a/fn.js', 'fn1') === '/api/a/fn1', 'routeMapperFn failed');
assert(routeMapperFn('/api/b/fn.js', 'fn1') === '/api/b/fn1', 'routeMapperFn failed');
assert(routeMapperFn('/api/index.js', 'fn1') === '/api/fn1', 'routeMapperFn failed');
assert(routeMapperFn('/api/fn.js', 'fn1') === '/api/fn1', 'routeMapperFn failed');
assert(routeMapperFn('/api/nofn.js', 'fn1') === '/api/fn1', 'routeMapperFn failed');

assert(routeMapperFn('api/a/fn.js', 'main') === '/api/a/', 'routeMapperFn failed');
assert(routeMapperFn('api/b/fn.js', 'index') === '/api/b/', 'routeMapperFn failed');
assert(routeMapperFn('api/index.js', 'index') === '/api/', 'routeMapperFn failed');
assert(routeMapperFn('api/fn.js', 'main') === '/api/', 'routeMapperFn failed');
assert(routeMapperFn('api/nofn.js', 'fn1') === '/api/fn1', 'routeMapperFn failed');
assert(routeMapperFn('api/a/fn.js', 'fn1') === '/api/a/fn1', 'routeMapperFn failed');
assert(routeMapperFn('api/b/fn.js', 'fn1') === '/api/b/fn1', 'routeMapperFn failed');
assert(routeMapperFn('api/index.js', 'fn1') === '/api/fn1', 'routeMapperFn failed');
assert(routeMapperFn('api/fn.js', 'fn1') === '/api/fn1', 'routeMapperFn failed');
assert(routeMapperFn('api/nofn.js', 'fn1') === '/api/fn1', 'routeMapperFn failed');


assert(routeMapperFn('https://raw.githubusercontent.com/noroutine/fn/master/api/index.js', 'fn1') === '/api/fn1', 'routeMapperFn failed');

console.log(`\n👉 Loading functions from local filesystem\n`)

var localLocations = glob.sync('./api/**/*.js', { ignore: "./node_modules/**" }) 

for (const localLocation of localLocations) {
    await loadRoutesFromLocation(app, `./${localLocation}`, '/local', routeMapperFn)
}
console.log(`\n🎉 All routes from filesystem are loaded\n`);

console.log(`\n👉 Loading functions from remote locations\n`)

var httpLocations = [
    "https://raw.githubusercontent.com/noroutine/fn/master/api/index.js",
    "https://raw.githubusercontent.com/noroutine/fn/master/api/a/fn.js",
    "https://raw.githubusercontent.com/noroutine/fn/master/api/a/b/fn.js",
    "https://raw.githubusercontent.com/noroutine/fn/master/api/fn.js",
    "https://raw.githubusercontent.com/noroutine/fn/master/api/nofn.js",
]

for (const remoteLocation of httpLocations) {
    await loadRoutesFromLocation(app, remoteLocation, '/remote', routeMapperFn)
}

console.log(`\n🎉 All remote routes are loaded\n`);

const server = app.listen(port, () => {
    console.log(`\n🚀 Fn is listening on port ${port}\n`);
});

let connections = [];

server.on('connection', connection => {
    connections.push(connection);
    connection.on('close', () => connections = connections.filter(curr => curr !== connection));
});

// setInterval(() => server.getConnections(
//     (err, connections) => console.log(`${connections} connections currently open`)
// ), 1000);

process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);

function shutDown() {
    console.log('Received kill signal, shutting down gracefully');
    server.close(() => {
        console.log('Closed out remaining connections');
        process.exit(0);
    });

    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);

    console.log(`${connections.length} connections currently open`)
    connections.forEach(curr => curr.end());
    setTimeout(() => connections.forEach(curr => curr.destroy()), 5000);
}

// export function index(req, res) {
//     res.send('index from server.js');
// }