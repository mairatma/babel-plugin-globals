babel-plugin-globals
===================================

A babel plugin that exposes ES6 modules to global variables.

##Usage
This is a [babel plugin](https://babeljs.io/docs/advanced/plugins/) that converts ES6 modules into global variables. To use it, just add it to your package.json and pass it as a plugin when calling babel:

```javascript
{
  "plugins": [
    ["globals", {
      "globalName": 'myGlobal'
    }]
  ],
  "filename": filename
}
// Modules will be available at this.myGlobal.
```

## API
This plugin requires passing the following plugin/babel options (besides adding the plugin):

### Plugin options
- `globalName` **{string}** The name of the global variable that the modules should be exported to.

### Babel options
- `filename` **{string}** This is an optional existing babel option, but is required for this plugin, since the plugin uses the file name to decide the name of the keys that will be exported in the global variable.
