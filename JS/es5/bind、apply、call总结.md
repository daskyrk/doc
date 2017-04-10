##bind、apply、call总结
---
call与apply除了调用方法有点区别外其他一致，这里仅以apply来说明

**先来看看bind实现**

```javascript
Function.prototype.bind = function (scope) {
    var fn = this;
    return function () {
        return fn.apply(scope);
    };
}
```
**使用以下测试函数**

```javascript
var a = function(){
	console.log('this:', this);
    return arguments.callee;
}
```
**执行：**

```javascript
a.apply({test:'apply'}); //this: Object {test: "apply"}
```

```javascript
a.bind({test:'bind'})(); //this:{test: "bind"}
```
估计结果应该不出大家的意外。

那么执行以下代码，会是什么结果？

```javascript
a.apply({test:'apply'}).bind({test:'bind'})()
a.bind({test:'bind'})().apply({test:'apply'})
```

如果是下面这段呢：

```javascript
a.bind({test:'bind'}).apply({test:'apply'})
```

结果是：

```javascript
a.bind({test:'bind'})().apply({test:'apply'})
/*
	this:{test: "bind"}
	this:{test: "apply"}
*/
a.apply({test:'apply'}).bind({test:'bind'})()
/*
	this:{test: "apply"}
	this:{test: "bind"}
*/
a.bind({test:'bind'}).apply({test:'apply'})
//	this:{test: "bind"}
```

将bind方法增加一行，打印出返回函数的this：

```javascript
Function.prototype.bind = function (scope) {
    var fn = this;
    return function () {
        console.info(this); //{test: "apply"}
        return fn.apply(scope);
    };
}

// 执行
a.bind({test:'bind'}).apply({test:'apply'});
/*
	Object {test: "apply"}
	this: Object {test: "bind"}
*/
```
---

这下应该明白了，`a.bind({test:'bind'})`返回的是

```javascript
function() {
    console.info(this); //{test: "apply"}
    return fn.apply(scope);// scope = {test: "bind"}
};
```
后面再执行apply时，将{test:'apply'}对象绑定到了返回函数的this上，而不是fn(即a)的this上，所以bind之后再apply，是没有效果的。

其实，从`fn.apply(scope)`这句我们就能看出：最终fn的this指向是scope参数，所以，在内部没有办法再改变this指向。

**那么，多次调用bind会是什么情况呢：**

`a.bind({test:'bind'}).bind({test:'bind2'})()`

流程分析：

a.bind({test:'bind'})返回的是：

```javascript
function () {
    console.info(this);
    return fn.apply(scope);// a.apply({test:'bind'})
}
```

整体简化一下：

```javascript
(function () {
    console.info(this);
    return a.apply({test:'bind'});
}).bind({test:'bind2'})()
```

然后返回的是：

```javascript
function () {
    console.info(this);
    return (function () {
                console.info(this);
                return a.apply({test:'bind'});
            }).apply({test:'bind2'});
}
```

最终执行的是：

```javascript
(function () {
    console.info(this);// Window
    return (function () {
                console.info(this);// 因为下面的apply，这里的this是{test:'bind2'}
                return a.apply({test:'bind'});// 执行a，this为{test:'bind'}
            }).apply({test:'bind2'});
})()
/*结果
	先是console.info打印的：
	Window
	Object {test: "bind2"}
	然后是执行a打印的：
	this: Object {test: "bind"}
*/
```

所以，多次bind，也只是在绑定在了外层的包裹方法上，最终执行目标方法时的this是第一个bind的对象。