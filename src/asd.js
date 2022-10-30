
var md = window.markdownit({
  html: true,
  linkify: true,
  typographer: true
});

const ws = new WebSocket('ws://localhost:9898/');
ws.onopen = function() {
    console.log('WebSocket Client Connected');
    ws.send('Hi this is web client.');
};


ws.onmessage = function(e) {
  received = JSON.parse(e.data)
  // if (e.data.action == "reload") {
  //     window.location.reload();
  // }
  // document.querySelector('#mdText').innerHTML = md.render(received.text);
  //

    let markdownBody = document.querySelector('#mdText')
    const morphdom = window.morphdom;

    const diff = morphdom(
    markdownBody,
    "<div>" + md.render(received.text) + "<div>",
    {
      childrenOnly: true,
      onBeforeElUpdated: (fromEl, toEl) => {
        if (fromEl.hasAttribute('open')) {
          toEl.setAttribute('open', 'true');
        }
        return !fromEl.isEqualNode(toEl);
      },
   onElUpdated: function(el) {
       // console.log(el)
       el.scrollIntoView()

       // el.scrollTop = el.scrollHeight - el.clientHeight;
    },
      getNodeKey: () => null,
    },
    );
};

  </script>

