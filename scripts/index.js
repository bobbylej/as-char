console.log('index')
let loader = document.getElementById('loader');
document.getElementById('form').addEventListener("submit", submit);

function submit(evt) {
  evt.preventDefault();
  let resource = evt.target.elements[0].value;
  if (!resource) {
    return false;
  }
  console.log('sub', evt.target.elements[0].value);
  loader.className += loader.className ? ' active' : 'active';
  window.location.href = '/result?resource=' + resource;
}
