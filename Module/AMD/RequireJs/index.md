[参考文档](http://www.mamicode.com/info-detail-202102.html)

**实现思路：**

首先是一个依赖的数组，其次是一个回调，回调要求依赖项全部加载才能运行，并且回调的参数便是依赖项执行的结果，所以一般要求define模块具有一个返回值



**模块引入：**

首先，根据依赖数组依次分析每个模块，如果当前模块有依赖项，则准备加载每个依赖项，如果没有则在当前调用栈执行结束后保存当前模块。

**模块加载：**

获得url，如果当前模块还未创建script标签进行加载，则创建；如果创建了，则判断加载状态，如果为'loaded'，则在当前调用栈结束后执行模块加载完成的回调函数，否则将回调函数压人回调函数数组。

**模块保存：**

执行时机：1. 无依赖项时保存  2. 依赖项都加载完成时保存

保证执行时，就说明当前模块的依赖（无论有无）都已经加载完了，所以可以保存当前模块了。保存时，改变模块的加载状态为‘loaded‘，将模块向外暴露的对象放到模块的export对象上。然后开始依次执行之前保存的回调函数列表，在这个回调函数中，将依赖当前模块的依赖数-1，接着判断依赖当前模块的模块，是否依赖的数量为0了，为0就表示可以保存那个模块了。



**依赖树：**

main  =>  ['util', 'num', 'math']

math  => ['num']

num => []

util => []



**执行流程：**

加载main模块 => main模块依赖3个模块（util，num，math）=> 开始循环加载依赖的3个模块 => 

​	第一个 util => util不在moduleCache中 => moduleCache中添加util模块信息，创建script标签进行加载 => 

​	第一个 num => num不在moduleCache中 => moduleCache中添加num模块信息，创建script标签进行加载 => 

​	第一个 math => math不在moduleCache中 => moduleCache中添加math模块信息，创建script标签进行加载 => 

循环结束(当前调用栈结束) => 根据网络情况，等待一段时间 => 

​	util加载完成 => 执行util模块代码，进入define函数(这里实际和require是同一个函数) => 开始处理util模块 => util没有依赖项，可以直接保存 => 添加定时器，当前循环完成后保存 => 

​	num加载完成 => 执行num模块代码，进入define函数 =>  开始处理num模块 => num没有依赖项，可以直接保存 => 添加定时器，当前循环完成后保存 => 

​	math加载完成 => 执行math模块代码，进入define函数 =>  开始处理math模块 => math有依赖项,依赖num => 加载num => num在moduleCache中 => 在num的加载完成回调列表中加一个"依赖回调函数" => 当前调用栈结束 => 执行定时器 =>

​	保存util模块 => moduleCache中util模块的状态改为'loaded'，调用定义模块时的第二个参数获得模块的export => 循环调用本模块加载完成的回调列表(只有Main模块依赖util，所以列表中只有一个) => Main对util的依赖数-1，Main的依赖数为0吗？ => 不为0 => 循环结束(当前调用栈结束) => 执行定时器 =>

​	保存num模块 => moduleCache中num模块的状态改为'loaded'，调用定义模块时的第二个参数获得模块的export => 循环调用本模块加载完成的"依赖回调函数"列表(Main和math模块都依赖num，所以列表中有两个) => Main对num的依赖数-1，Main的依赖数为0吗？ => 不为0 => 继续循环下一个回调 => math对num的依赖数-1，math的依赖数为0吗？ => 为0 => 可以保存math模块了

​	保存math模块 => moduleCache中math模块的状态改为'loaded'，调用定义模块时的第二个参数获得模块的export => 循环调用本模块加载完成的回调列表(只有Main模块依赖num，所以列表中只有一个) => Main对math的依赖数-1，Main的依赖数为0吗？ => 为0 => 可以保存main模块了

​	保存Main模块 => moduleCache中Main模块的状态改为'loaded'，调用定义模块时的第二个参数获得模块的export => 循环调用本模块加载完成的回调列表(没有依赖Main模块的模块) => 执行主模块定义的回调函数(即页面里的) => 执行结束

![流程](https://ww2.sinaimg.cn/large/006tNc79gy1fejo7ldfgnj30v80v0gtw.jpg)

**流程图：**

![流程图](https://www.gliffy.com/go/share/image/s9s3p68e65bggs88od08.png?utm_medium=live-embed&utm_source=custom)



调用完主模块后，全局对象上就已经有了require和define方法：

```javascript
  window.require = require;
  window.define = require;
```

然后在每个js文件加载结束后，浏览器会自动去执行里面的代码，所以这里即使不监听script的onLoad事件，也可以通过调用`define()`知道这个模块加载好了