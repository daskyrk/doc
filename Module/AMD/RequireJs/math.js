//math
define(['num'], function (num) {
  return {
    getRandom: function () {
      console.info("num",num);
      return parseInt(Math.random() * num);
    }
  };
});
