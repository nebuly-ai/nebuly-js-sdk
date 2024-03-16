let NebulyCallbackHandler;

import('./langchain_handler.js')
  .then(module => {
    NebulyCallbackHandler = module.NebulyCallbackHandler;
  })
  .catch(e => {
    console.error('Error loading NebulyCallbackHandler:', e);
    NebulyCallbackHandler = null;
  });

export { NebulyCallbackHandler };
