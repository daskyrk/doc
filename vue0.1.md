# vue学习

## 0.1版本

[TOC]

### 模块加载过程

1. 先定义好每一个模块的路径和定义方法:

   ```javascript
   require.register("component-emitter/index.js",function(exports, require, module){
     module.exports = {}
   });
   ```

   ​


2. 然后在最后执行一个require:

   ```javascript
   window.Seed = window.Seed || require('seed')
   ```

   因为定义了alias:

   ```javascript
   require.alias("seed/src/main.js", "seed/index.js");//前一个参数是模块路径，后一个参数是别名
   ```

   所以会去找已经注册过的模块：`seed/src/main.js`

   ```javascript
   require.register("seed/src/main.js", function(exports, require, module){
     //然后在这里依次拿到每一个注册的模块
     //注意：这里面的require实际上是localRequire方法，将相对路径转换为绝对路径
     var config      = require('./config'),
         Seed        = require('./seed'),
         directives  = require('./directives'),
         filters     = require('./filters'),
         textParser  = require('./text-parser')

     var controllers = config.controllers,
         datum       = config.datum,
         api         = {},
         reserved    = ['datum', 'controllers'],
         booted      = false
     
     .......
   }
   ```

3. localRequire内部转换完路径后调用require方法，获取模块：

   ```javascript
   function localRequire(path) {// path = "./config"
       var resolved = localRequire.resolve(path);// resolved = "seed/src/config"
       return require(resolved, parent, path);// 注意这里的resolved路径还没有后缀
   }
   ```

4. require在返回前，如果没有exports会执行定义的模块方法以拿到exports：

   ```javascript
   function require(path, parent, orig) {
     var resolved = require.resolve(path);// resolved = "seed/src/config.js"

     // lookup failed
     if (null == resolved) {
       orig = orig || path;
       parent = parent || 'root';
       var err = new Error('Failed to require "' + orig + '" from "' + parent + '"');
       err.path = orig;
       err.parent = parent;
       err.require = true;
       throw err;
     }

     var module = require.modules[resolved];

     // perform real require()
     // by invoking the module's
     // registered function
     if (!module.exports) {
       module.exports = {};
       module.client = module.component = true;
       module.call(this, module.exports, require.relative(resolved), module);//在这里执行模块定义方法以初始化模块内部并获得exports
     }

     return module.exports;
   }
   ```

   这样，每一个模块require之后就已经拿到了模块对外的接口


------



### **todos app初始化流程**

##### 1.  注册controller

```javascript
Seed.controller('Todos', function (scope) {
  ....
}
```

```javascript
api.controller = function (id, extensions) {
    if (!extensions) return controllers[id]
 	//这里controllers是config.controllers的引用，所以修改会反映到config中   
    controllers[id] = extensions //controllers[id] = todos
}
```
##### 2. 执行bootstrap启动方法

```javascript
Seed.bootstrap({ debug: true })
```

启动方法实现：

```javascript
api.bootstrap = function (opts) {
    if (booted) return
    if (opts) {//合并option
        for (var key in opts) {
            if (reserved.indexOf(key) === -1) {
                config[key] = opts[key]
            }
        }
    }
    textParser.buildRegex()// 获得一个解析插值区域的Reg：BINDING_RE = /\{\{(.+?)\}\}/
    var el,
        ctrlSlt = '[' + config.prefix + '-controller]',// [sd-controller]
        dataSlt = '[' + config.prefix + '-data]',// [sd-data]
        seeds   = []
    /* jshint boss: true */
    while (el = document.querySelector(ctrlSlt) || document.querySelector(dataSlt)) {
        seeds.push((new Seed(el)).scope) //3. 找包含自定义的controller和data属性的元素，初始化组件
    }
    booted = true
    return seeds.length > 1 ? seeds : seeds[0]
}
```
##### 3.  初始化组件实例

```javascript
function Seed (el, options) {

    if (typeof el === 'string') {
        el = document.querySelector(el)
    }

    this.el         = el
    el.seed         = this
    this._bindings  = {}
    this._computed  = []

    // copy options
    options = options || {}
    for (var op in options) {
        this[op] = options[op]
    }

    // check if there's passed in data
    var dataAttr = config.prefix + '-data',
        dataId = el.getAttribute(dataAttr),
        data = (options && options.data) || config.datum[dataId]
    if (config.debug && dataId && !data) {
        console.warn('data "' + dataId + '" is not defined.')
    }
    data = data || {}
    el.removeAttribute(dataAttr)

    // if the passed in data is the scope of a Seed instance,
    // make a copy from it
    if (data.$seed instanceof Seed) {
        data = data.$dump()
    }

    // initialize the scope object
    var scope = this.scope = new Scope(this, options)//每一个实例都包含一个scope对象
    /*
    function Scope (seed, options) {
      this.$seed     = seed
      this.$el       = seed.el
      this.$index    = options.index
      this.$parent   = options.parentSeed && options.parentSeed.scope
      this.$watchers = {}
	}
    */

    // copy data
    for (var key in data) {
        scope[key] = data[key]
    }

    // if has controller function, apply it so we have all the user definitions
    var ctrlID = el.getAttribute(ctrlAttr)
    if (ctrlID) {
        el.removeAttribute(ctrlAttr)
        var factory = config.controllers[ctrlID] //注意一下这里config里的controllers从哪里来的
        if (factory) {
            factory(this.scope)//4. 在这里执行自己的代码，也就是app.js中注册controller时的第二个参数
        } else if (config.debug) {
            console.warn('controller "' + ctrlID + '" is not defined.')
        }
    }

    // now parse the DOM
    this._compileNode(el, true)// 5. 解析dom

    // extract dependencies for computed properties
    depsParser.parse(this._computed)
    delete this._computed
}
```
##### 4.  执行app的方法

==**注意：**所有实例上的属性和方法都是在scope对象上==

```javascript
var storageKey = 'todos-seedjs',
    storedData = JSON.parse(localStorage.getItem(storageKey))

Seed.controller('Todos', function (scope) {

    // regular properties -----------------------------------------------------
    scope.todos = Array.isArray(storedData) ? storedData : []
    scope.remaining = scope.todos.reduce(function (n, todo) {
        return n + (todo.done ? 0 : 1)
    }, 0)
    scope.filter = location.hash.slice(2) || 'all'

    // computed properties ----------------------------------------------------
    scope.total = {get: function () {
        return scope.todos.length
    }}

    scope.completed = {get: function () {
        return scope.total - scope.remaining
    }}

    scope.itemLabel = {get: function () {
        return scope.remaining > 1 ? 'items' : 'item'
    }}

    scope.allDone = {
        get: function () {
            return scope.remaining === 0
        },
        set: function (value) {
            scope.todos.forEach(function (todo) {
                todo.done = value
            })
            scope.remaining = value ? 0 : scope.total
        }
    }

    // event handlers ---------------------------------------------------------
    scope.addTodo = function (e) {
        if (e.el.value) {
            scope.todos.unshift({ text: e.el.value, done: false })
            e.el.value = ''
            scope.remaining++
        }
    }

    // e对象有三个属性：el、originalEvent、scope
    scope.removeTodo = function (e) {
        scope.todos.remove(e.scope)//这里scope对象是如何封装的？ 见/directives/on.js中
        scope.remaining -= e.scope.done ? 0 : 1
    }

    scope.updateCount = function (e) {
        scope.remaining += e.scope.done ? -1 : 1
    }

    scope.edit = function (e) {
        e.scope.editing = true
    }

    scope.stopEdit = function (e) {
        e.scope.editing = false
    }

    scope.removeCompleted = function () {
        if (scope.completed === 0) return
        scope.todos = scope.todos.filter(function (todo) {
            return !todo.done
        })
    }

    // listen for hash change
    window.addEventListener('hashchange', function () {
        scope.filter = location.hash.slice(2)
    })

    // save on leave
    window.addEventListener('beforeunload', function () {
        localStorage.setItem(storageKey, scope.$serialize('todos'))
    })

    scope.$watch('completed', function (value) {
        scope.$unwatch('completed')
    })

})

Seed.bootstrap({ debug: true })
```
##### 5.  解析dom

```javascript
SeedProto._compileNode = function (node, root) {
    var seed = this

    if (node.nodeType === 3) { // text node

        seed._compileTextNode(node) // 6. 文本节点插值替换

    } else if (node.nodeType === 1) {

        var eachExp = node.getAttribute(eachAttr),// sd-each
            ctrlExp = node.getAttribute(ctrlAttr)// sd-controller

        if (eachExp) { // each block

            var directive = DirectiveParser.parse(eachAttr, eachExp)
            if (directive) {
                directive.el = node
                seed._bind(directive)
            }

        } else if (ctrlExp && !root) { // nested controllers

            new Seed(node, {
                child: true,
                parentSeed: seed
            })

        } else { // normal node

            // parse if has attributes
            if (node.attributes && node.attributes.length) {
                // forEach vs for loop perf comparison: http://jsperf.com/for-vs-foreach-case
                // takeaway: not worth it to wrtie manual loops.
                slice.call(node.attributes).forEach(function (attr) {
                    if (attr.name === ctrlAttr) return
                    var valid = false
                    attr.value.split(',').forEach(function (exp) {
                        var directive = DirectiveParser.parse(attr.name, exp)//解析指令
                        if (directive) {
                            valid = true //校验是否为directive的flag 
                            directive.el = node
                            seed._bind(directive) //7. 绑定指令
                        }
                    })
                    if (valid) node.removeAttribute(attr.name)//如果是指令属性则去除
                })
            }

            // recursively compile childNodes
            if (node.childNodes.length) {
                slice.call(node.childNodes).forEach(seed._compileNode, seed)
            }
        }
    }
}
```

##### 6.  文本节点插值替换

```javascript
SeedProto._compileTextNode = function (node) {
    var tokens = TextParser.parse(node)
    if (!tokens) return
    var seed = this,
        dirname = config.prefix + '-text',
        el, token, directive
    for (var i = 0, l = tokens.length; i < l; i++) {
        token = tokens[i]// token = {key: "remaining"}
        el = document.createTextNode('')
        if (token.key) {
            directive = DirectiveParser.parse(dirname, token.key) //dirname="sd-text"
            if (directive) {// 注意这里同样会绑定指令
                directive.el = el
                seed._bind(directive)// 内部会修改text值
            }
        } else {
            el.nodeValue = token
        }
        node.parentNode.insertBefore(el, node)// 先在前面加上包含计算后的值的文本节点
    }
    node.parentNode.removeChild(node)// 然后移除占位符{{...}}
}
```



##### 7.  其他节点解析和绑定指令

以=="keyup:addTodo | key enter"==为例

```javascript
SeedProto._bind = function (directive) {

    var key = directive.key,
        seed = directive.seed = this

    // deal with each block
    if (this.each) {
        if (key.indexOf(this.eachPrefix) === 0) {
            key = directive.key = key.replace(this.eachPrefix, '')
        } else {
            seed = this.parentSeed
        }
    }

    // deal with nesting
    seed = traceOwnerSeed(directive, seed)
    var binding = seed._bindings[key] || seed._createBinding(key)

    // add directive to this binding
    binding.instances.push(directive)
    directive.binding = binding

    // invoke bind hook if exists
    if (directive.bind) {
        directive.bind(binding.value)
    }

    // set initial value
  	// 文本节点时这里的value是文本节点的值
  	// 其他节点时这里的value是自定义的方法，即addTodo方法
    directive.update(binding.value) // 初始化时这里调用DirProto上的update方法，判断是否有filter后调用了下面的update
    if (binding.isComputed) {
        directive.refresh()
    }
}
```

###### 如果有filter

```javascript
DirProto.apply = function (value) {
    if (this.inverse) value = !value
    this._update(
        this.filters
        ? this.applyFilters(value)// 有filter则先过滤一下
        : value // 文本节点直接用value
    )
}

DirProto.applyFilters = function (value) {
    var filtered = value
    this.filters.forEach(function (filter) {
        if (!filter.apply) throw new Error('Unknown filter: ' + filter.name)
        filtered = filter.apply(filtered, filter.args)// 这里的args就是‘enter’,filtered就是addTodo方法
    })
    return filtered
}
```

接着执行filters.js中export的key方法：

```javascript
key: function (handler, args) {
    var code = keyCodes[args[0]]
    if (!code) {
      code = parseInt(args[0], 10)
    }
    return function (e) {// 注意返回的是一个方法
      if (e.originalEvent.keyCode === code) {// 方法中做了filter，如果是指定code则执行handler(即addTodo)
        handler.call(this, e)
      }
    }
}
```

filter执行完后开始绑定指令事件

其中directive.exports的update方法：

```javascript
update: function (handler) { // 这里的参数就是自定义的handler，如addTodo方法

        this.unbind()
        if (!handler) return

        var seed  = this.seed,
            event = this.arg

        if (seed.each && event !== 'blur' && event !== 'blur') {
           ......

        } else {
            // a normal, single element handler 构造handler
            this.handler = function (e) {
                handler.call(seed.scope, {// 封装自定义方法的参数
                    el: e.currentTarget,
                    scope: seed.scope,
                    originalEvent: e
                })
            }
            this.el.addEventListener(event, this.handler) // 绑定事件

        }
    },
```

对于指令"keyup:addTodo | key enter"来说，先执行filter（特定条件enter），限制handler的执行条件，然后将限制后的方法绑定到keyup事件上



### 指令执行流程示例

### （1）切换todo状态

toggle上定义了两个指令：==这里应该有优先顺序？==

```javascript
sd-checked="todo.done"
sd-on="change:updateCount"
```

##### 1.  执行checked指令

首先触发sd-checked定义里的change方法

```javascript
checked: {
    bind: function() {
        if (this.oneway) return var el = this.el,self = this 
        this.change = function() {//1. 触发change
            self.seed.scope[self.key] = el.checked // 2. 更新done为true,触发set
        }
        el.addEventListener('change', this.change)
    },
    update: function(value) { // 4.2 最终更新done的值
        this.el.checked = !!value
    },
    unbind: function() {
        if (this.oneway) return this.el.removeEventListener('change', this.change)
    }
},
```

##### 2.  触发属性的set方法

```javascript
def(scope, key, { //scope上的每一个属性都定义了get\set方法
    get: function() {
        if (observer.isObserving) {
            observer.emit('get', self)
        }
        return self.isComputed ? self.value.get() : self.value
    },
    set: function(value) {
        if (self.isComputed) {
            // computed properties cannot be redefined
            // no need to call binding.update() here,
            // as dependency extraction has taken care of that
            if (self.value.set) {
                self.value.set(value)
            }
        } else if (value !== self.value) {
            self.update(value) // 3. 更新属性
        }
    }
})
```

##### 3.  进入update方法

```javascript
BindingProto.update = function (value) {
    this.inspect(value)
    var i = this.instances.length //instances内容见下图
    // 注意这里的instances中，第二个并不是 sd-on="change:updateCount"
    // 而是上级dom绑定的 sd-class="completed:todo.done, editing:todo.editing"
    // todo： 学习一下这里是如何正确绑定的
    while (i--) {
        this.instances[i].update(value) //4. 每一个指令更新
    }
    this.pub()// 5. 发布变更消息
}
```

![instances内容](http://ww2.sinaimg.cn/large/65e4f1e6gw1f7s0wc8ryqj21eg05wdhx.jpg)

##### 4.  进入指令update方法

```javascript
DirProto.update = function (value) {
    if (value && (value === this.value)) return
    this.value = value
    this.apply(value) // 4.1 更新值
}

DirProto.apply = function (value) {
    if (this.inverse) value = !value
    this._update( //4.2. 进入checked的update,这里才最终更新done属性，更新dom
        this.filters
        ? this.applyFilters(value)
        : value
    )
}
```

同理，执行第二个binding修改类名，添加完成的样式

##### 5.  发布变更消息

```javascript
BindingProto.pub = function () {
    var i = this.subs.length
    while (i--) { // 注意这里是倒序遍历
        this.subs[i].refresh() //6. refresh
    }
}
```

第一次时，this.subs为空，直接跳过，然后会触发change事件

##### 6.  执行第二个指令

`sd-on="change:updateCount"`

```javascript
scope.updateCount = function (e) {
  	scope.remaining += e.scope.done ? -1 : 1
}
```

注意先get了done属性，然后再set remaining，最后执行的是文本节点的更新方法

```javascript
text: function (value) {
  this.el.textContent =
    (typeof value === 'string' || typeof value === 'number')
    ? value : ''
},
```

更新完后，同样执行pub()方法，但这时，观察"remaining"的有四个:

![subs](http://ww4.sinaimg.cn/large/65e4f1e6gw1f7s1pvjl28j21kw0s179w.jpg)

| 形式                   | 说明                    | 类型    |
| -------------------- | --------------------- | ----- |
| sd-checked="allDone" | 是否全选的toggle           | input |
| {{itemLabel}}        | 剩余项标签（item和items切换）   | 文本节点  |
| {{completed}}        | 完成项数量                 | 文本节点  |
| 自定义的watcher          | 只有第一次会有，然后移除，之后就没有这个了 | 方法    |

todo: 第四个作用？

##### 7.  观察者refresh

因为是倒序遍历，所以第一个是object

```javascript
ScopeProto.$watch = function (key, callback) {
    var self = this
    // yield and wait for seed to finish compiling
    setTimeout(function () {
        var scope   = self.$seed.scope,
            binding = self.$seed._bindings[key],
            watcher = self.$watchers[key] = {
                refresh: function () { //执行这里
                    callback(scope[key])// key为completed时，scope[completed]=2
                },
                deps: binding.deps
            }
        binding.deps.forEach(function (dep) {
            dep.subs.push(watcher)
        })
    }, 0)
}
```

读取scope[key]时会调用get，自定义方法：

```javascript
scope.completed = {get: function () {
  return scope.total - scope.remaining // 这里又会调用scope.total里的get
}}

scope.total = {get: function () {
  return scope.todos.length
}}
```

而callback则是自己注册的watch

```javascript
scope.$watch('completed', function (value) {
  scope.$unwatch('completed') // 为什么取消观察？ 因为要移除四个观察对象中的那个object
})
```

在下一次事件循环前取消观察：

```javascript
ScopeProto.$unwatch = function (key) {
    var self = this
    setTimeout(function () {
        var watcher = self.$watchers[key]
        if (!watcher) return
        watcher.deps.forEach(function (dep) {
            dep.subs.splice(dep.subs.indexOf(watcher)) //移除watcher object
        })
        delete self.$watchers[key]
    }, 0)
}
```

然后执行前三个观察者（directive）的refresh

```javascript
DirProto.refresh = function () {
    var value = this.value.get() // 调用自定义的计算逻辑，获得value
    if (value === this.computedValue) return //没有变化直接返回
    this.computedValue = value //赋值
    this.apply(value) //内部调用指令的dom更新方法
    this.binding.pub() //继续发布变更消息
}
```

### （2）双击切换editing状态

##### 1.  执行edit

```javascript
//lebel上绑定了指令：sd-on="dblclick:edit"
scope.edit = function (e) {
  e.scope.editing = true //1. 触发set
}
```

##### 2.   触发set

```javascript
def(scope, key, {
  get: function () {
    if (observer.isObserving) {
      observer.emit('get', self)
    }
    return self.isComputed
      	? self.value.get()
    	: self.value
  },
  set: function (value) {
    if (self.isComputed) {
      // computed properties cannot be redefined
      // no need to call binding.update() here,
      // as dependency extraction has taken care of that
      if (self.value.set) {
        self.value.set(value)
      }
    } else if (value !== self.value) {
      self.update(value)// 2. 调用更新方法
    }
  }
})
```

##### 3.  进入更新

```javascript
BindingProto.update = function (value) {
    this.inspect(value)
    var i = this.instances.length
    // 这里的instances数据见下图
    while (i--) {
        this.instances[i].update(value) // 3. dom更新
    }
    this.pub()// 发布变更消息，触发其他地方更新
}
```

![instances](http://ww3.sinaimg.cn/large/65e4f1e6gw1f7rzv3z65ej21kw05cac9.jpg)

##### 4.  执行dom更新

调用指令的各种更新方法，先focus/blur再修改类名
```javascript
focus: function (value) {
  	this.el[value ? 'focus' : 'blur']()// 这里的focus方法不知道有什么用
},

class: function (value) {
    if (this.arg) {
      this.el.classList[value ? 'add' : 'remove'](this.arg)
    } else {
      if (this.lastVal) {
        this.el.classList.remove(this.lastVal)
      }
      this.el.classList.add(value)
      this.lastVal = value
    }
},
```

##### 



### 附：页面

```html
<!DOCTYPE html>
<html>
    <head>
        <title>Todo</title>
        <meta charset="utf-8">
        <link rel="stylesheet" type="text/css" href="common/base.css">
        <link rel="stylesheet" type="text/css" href="css/app.css">
    </head>
    <body>
        <section id="todoapp" sd-controller="Todos" sd-class="filter">

            <header id="header">
                <h1>todos</h1>
                <!-- main input box -->
                <input
                    id="new-todo"
                    autofocus
                    sd-on="keyup:addTodo | key enter"
                    placeholder="What needs to be done?"
                >
            </header>

            <section id="main" sd-show="total">
                <!-- toggle all checkbox-->
                <input
                    id="toggle-all"
                    type="checkbox"
                    sd-checked="allDone"
                >
                <ul id="todo-list">
                    <!-- a single todo item -->
                    <li
                        class="todo"
                        sd-each="todo:todos"
                        sd-class="completed:todo.done, editing:todo.editing"
                    >
                        <div class="view">
                            <input
                                class="toggle"
                                type="checkbox"
                                sd-checked="todo.done"
                                sd-on="change:updateCount"
                            >
                            <label
                                sd-text="todo.text"
                                sd-on="dblclick:edit"
                            ></label>
                            <button class="destroy" sd-on="click:removeTodo"></button>
                        </div>
                        <input
                            class="edit"
                            type="text"
                            sd-focus="todo.editing"
                            sd-on="blur:stopEdit, keyup:stopEdit | key enter"
                            sd-value="todo.text"
                        >
                    </li>
                </ul>
            </section>

            <!-- footer controls -->
            <footer id="footer" sd-show="total">
                <span id="todo-count">
                    <strong>{{remaining}}</strong> {{itemLabel}} left
                </span>
                <ul id="filters">
                    <li><a href="#/all">All</a></li>
                    <li><a href="#/active">Active</a></li>
                    <li><a href="#/completed">Completed</a></li>
                </ul>
                <button id="clear-completed" sd-on="click:removeCompleted">
                    Remove Completed ({{completed}})
                </button>
            </footer>

        </section>

        <!-- info -->
        <footer id="info">
            <p>Double-click to edit a todo</p>
            <p>Powered by <a href="https://github.com/yyx990803/seed">Seed.js</a></p>
            <p>Created by <a href="http://evanyou.me">Evan You</a></p>
        </footer>

        <!-- js -->
        <script src="../../dist/seed.js"></script>
        <script src="js/app.js"></script>
    </body>
</html>
```

### 附：app.js

```javascript
var storageKey = 'todos-seedjs',
    storedData = JSON.parse(localStorage.getItem(storageKey))

Seed.controller('Todos', function (scope) {

    // regular properties -----------------------------------------------------
    scope.todos = Array.isArray(storedData) ? storedData : []
    scope.remaining = scope.todos.reduce(function (n, todo) {
        return n + (todo.done ? 0 : 1)
    }, 0)
    scope.filter = location.hash.slice(2) || 'all'

    // computed properties ----------------------------------------------------
    scope.total = {get: function () {
        return scope.todos.length
    }}

    scope.completed = {get: function () {
        return scope.total - scope.remaining
    }}

    scope.itemLabel = {get: function () {
        return scope.remaining > 1 ? 'items' : 'item'
    }}

    scope.allDone = {
        get: function () {
            return scope.remaining === 0
        },
        set: function (value) {
            scope.todos.forEach(function (todo) {
                todo.done = value
            })
            scope.remaining = value ? 0 : scope.total
        }
    }

    // event handlers ---------------------------------------------------------
    scope.addTodo = function (e) {
        if (e.el.value) {
            scope.todos.unshift({ text: e.el.value, done: false })
            e.el.value = ''
            scope.remaining++
        }
    }

    scope.removeTodo = function (e) {
        scope.todos.remove(e.scope)
        scope.remaining -= e.scope.done ? 0 : 1
    }

    scope.updateCount = function (e) {
        scope.remaining += e.scope.done ? -1 : 1
    }

    scope.edit = function (e) {
        e.scope.editing = true
    }

    scope.stopEdit = function (e) {
        e.scope.editing = false
    }

    scope.removeCompleted = function () {
        if (scope.completed === 0) return
        scope.todos = scope.todos.filter(function (todo) {
            return !todo.done
        })
    }

    // listen for hash change
    window.addEventListener('hashchange', function () {
        scope.filter = location.hash.slice(2)
    })

    // save on leave
    window.addEventListener('beforeunload', function () {
        localStorage.setItem(storageKey, scope.$serialize('todos'))
    })

    // todo：这里为什么要手动watch
    scope.$watch('completed', function (value) {
        scope.$unwatch('completed')
    })

})

Seed.bootstrap({ debug: true })
```



### **思考**

1.    每一部分都分别是什么作用？
2.    为什么要这么组织？有什么优点？
3.    如何实现双向绑定？`sd-focus="todo.editing"`和`sd-checked="todo.done"`如何实现？是focus引起todo.editing变化还是todo.editing变化触发focus
4.    scope是什么意思？其作用是什么？




（1）每一部分的作用：

| 文件名              | 功能                                       |
| :--------------- | :--------------------------------------- |
| bindings         | 给scope对象绑定get、set方法和更新依赖的方法              |
| config           | 配置文件，配置类库基础前缀等                           |
| deps-parser      | 通过观察者自动解析属性依赖                            |
| directive-parser | 指令解析器                                    |
| filters          | 管道过滤器，用来做一些限制，比如key enter表示只有按下回车时执行     |
| main             | 主要api接口定义以及启动应用                          |
| scope            | 定义了一个Scope类，每个seed实例都包含这样一个对象            |
| seed             | Seed类的实例方法                               |
| text-parser      | 内容解析器                                    |
| utils            | 常用工具方法                                   |
| Emitter          | 观察者模式的实现                                 |
| require          | 简易的模块加载器，确切的说应该只有模块化，因为合并到一个文件里了，所以并没有加载的部分 |
|                  |                                          |

（2）优点：

每一部分都是单独的一个工具类，维护简单方便，只要提供了一致的对外接口，内部就可以无痛升级

所有自己的，业务相关的代码都放在app.js中，绑定事件、依赖管理、自动更新等都是透明的，用户只用关注自己的逻辑



##### 

