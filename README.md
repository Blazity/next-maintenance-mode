# Next.js Maintenance Mode

## Overview

`next-maintenance-mode` is a middleware specially designed for Next.js applications, enabling you to easily toggle maintenance mode on and off. When activated, it redirects users to a designated maintenance page, while still keeping essential parts of your site operational. Its compatibility with multiple configuration providers such as Upstash and Edge Config allows for flexible and dynamic maintenance state management.

## Motivation
Currently, setting up a maintenance mode in Next.js applications can be a complex process, especially when using platforms like Vercel which don't inherently support a maintenance mode option like some other platforms such as Heroku. This existing gap presents a significant opportunity for innovation. Popular solutions, including creating a separate component within the _app file and using environment variables, require a complete app rebuild, which is not only time-consuming but often fails to secure API routes adequately.

To address this, we are introducing a streamlined solution that offers the choice between two providers, each with its unique advantages and limitations. Moreover, we implemented an optional cache mechanism which helps in saving bandwidth. This makes our solution not only cost-effective but also remarkably flexible, simplifying the maintenance mode setup process significantly.

|      Provider      |  Reads (free plan)   |
| ------------------ | -------------------   |
| Vercel/Edge-Config | 50k/month             | 
| Upstash/Redis      | ~ 300k/month (10k/day) | 


## Features

- ⚡️ **App Directory Ready**: Easily integrates with the new Next.js app directory.
- 🛠️ **Seamless Integration**: Designed to work hand-in-hand with Next.js applications, ensuring an intuitive setup process and seamless operation.
- 📚 **Multi-Provider Support**: Flexibility to choose between Upstash and Edge Config for configuration, adapting to your preferred workflow and tools.
- 💻 **Simple API**: With a straightforward API and minimal setup requirements, integrating `next-maintenance-mode` is a breeze.

## Installation

To get started with `next-maintenance-mode`, you can install the package using your preferred package manager:

```bash
$ yarn add next-maintenance-mode

# or

$ npm install --save-dev next-maintenance-mode

# or

$ pnpm i -D next-maintenance-mode
```

## Usage

To integrate `next-maintenance-mode` into your Next.js application, insert the following code into your middleware file.

```javascript
import { withMaintenanceMode } from 'next-maintenance-mode';

const middlewareOptions = {
  provider: 'upstash' | 'edge-config', // Mandatory
  maintenancePageSlug: '/maintenance', // Optional
  key: 'your_key_here', // Optional
  cacheTime: 'number' //Optional - defined in ms for e.g. 60000 = one minute
};

withMaintenanceMode({
  beforeCheck: NextMiddleware, // function which will be executed before checking the maintenance mode
  afterCheck: NextMiddleware // function which will be executed after checking the maintenance mode
}, 'your_connection_string_here', middlewareOptions);
```

Before using the middleware, you need to configure it with the necessary settings. Here are the options you can specify:

- **provider:** Identify your configuration provider, choose between 'upstash' or 'edge-config'. This field is mandatory.
- **maintenancePageSlug:** Specify the route to your maintenance page. The default setup directs to '/maintenance'.
- **key:** Create a unique key to indicate the maintenance mode state in your configuration provider, defaulting to 'isInMaintenanceMode'.
- **cacheTime:** Defined in milliseconds, determines how long data is stored in the cache before being refreshed. Utilizing an LRU (Least Recently Used) caching algorithm, helps to save bandwidth.

⚠️ LRU relies on the short-term memory, due to that cached maintenance state can be unexpectedly reset. If the cached state expires or disappears the mechanism still works but has to check and cache the state once again. Note that only maintenance status is cached, both middleware functions will should as expected.

#### The connection string structure differs between Upstash and Edge Config:

- **For Upstash:** Include both the URL and token, formatted as **`url@token`**.
- **For Edge Config:** Specify the API endpoint or path given by Edge Config.

## Error Messages

There are specific error messages which may be encountered while using the middleware:

- **Maintenance Key Missing Error:** 
  This error occurs if the maintenance key is not found in your configuration provider. It can be encountered when checking the maintenance mode state. 

- **Invalid Connection String:** 
  This error is triggered when the connection string does not match the selected provider.

- **Unsupported Provider Error:** 
  This error is thrown when an unsupported provider is passed to the function. 

- **Middleware Configuration Error:** 
  This error is thrown when neither `beforeCheck` nor `afterCheck` middleware functions are defined during the setup. It ensures that at least one of these functions is implemented to proceed with the maintenance mode check.

## 🙌 Contribution

Contributions are always welcome! To contribute, please follow these steps:

1. Fork the repository.
2. Create a new branch with a descriptive name.
3. Make your changes, and commit them.
4. Push your changes to the forked repository.
5. Create a pull request, and we'll review your changes.

## 📡 Community

If you're looking for help or simply want to share your thoughts about the project, we encourage you to join our Discord community. Here's the link: [https://blazity.com/discord](https://blazity.com/discord). It's a space where we exchange ideas and help one another. Everyone's input is appreciated, and we look forward to welcoming you.

<br />
<a href="https://blazity.com/discord" style="width: 100%; display: flex; justify-content: center;">
  <img src="https://discordapp.com/api/guilds/1111676875782234175/widget.png?style=banner2" alt="Blazity Discord Banner"/>
</a>
<br />
