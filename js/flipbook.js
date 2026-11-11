const $ = id => document.getElementById(id);
const leaves = Array.from(document.querySelectorAll('.leaf'));
let book,current=0,busy=false;
function fit() {
  const stage = $('stage');
  const padding = stage.clientWidth <= 600 ? 56 : 110;
  const width = Math.max(1, Math.floor(Math.min(
    (stage.clientWidth - padding) / 2,
    (stage.clientHeight - 32) * 487.559 / 646.299
  )));
  return { width, height: Math.round(width * 646.299 / 487.559) };
}
function update(){current=book.getCurrentPageIndex();const portrait=book.getOrientation()==='portrait';const end=current===0||current===leaves.length-1||portrait?current:Math.min(current+1,leaves.length-1);$('left').disabled=current===0;$('right').disabled=false;$('right').setAttribute('aria-label',current===leaves.length-1?'Return to front cover':'Next pages');if(document.activeElement!==$('page-number'))$('page-number').value=current+1}
function create(index){const size=fit();book=new St.PageFlip($('book'),{...size,size:'fixed',showCover:true,usePortrait:false,autoSize:true,maxShadowOpacity:.35,flippingTime:matchMedia('(prefers-reduced-motion: reduce)').matches?1:850,mobileScrollSupport:false,swipeDistance:25,showPageCorners:true,startPage:index});book.on('flip',update);book.on('changeOrientation',()=>setTimeout(update,0));book.on('changeState',e=>busy=e.data!=='read');book.loadFromHTML(document.querySelectorAll('.leaf'));update()}
create(0);
const pageInput = $('page-number');
pageInput.max = leaves.length;
$('page-total').textContent = '/ ' + leaves.length;

function jumpToPage() {
  if (busy) {
    pageInput.value = current + 1;
    return;
  }
  const number = pageInput.valueAsNumber;
  if (!Number.isInteger(number) || number < 1 || number > leaves.length) {
    pageInput.value = current + 1;
    return;
  }
  book.turnToPage(number - 1);
  pageInput.value = book.getCurrentPageIndex() + 1;
}

$('page-counter').addEventListener('submit', event => {
  event.preventDefault();
  jumpToPage();
  pageInput.blur();
});
pageInput.addEventListener('change', jumpToPage);
pageInput.addEventListener('blur', () => { pageInput.value = current + 1; });

function next(){if(busy)return;if(current===leaves.length-1)book.turnToPage(0);else book.flipNext()};function prev(){if(!busy)book.flipPrev()};
$('right').onclick=next;$('left').onclick=prev;
// Reserve the right half of the back cover for returning to the front.
function isBackCoverRight(e){const point=e.changedTouches?e.changedTouches[0]:e;const leaf=$('book').querySelector('.leaf:last-child');if(current!==leaves.length-1||!leaf)return false;const rect=leaf.getBoundingClientRect();return point.clientX>=rect.left+rect.width/2&&point.clientX<=rect.right&&point.clientY>=rect.top&&point.clientY<=rect.bottom}
for(const type of ['mousedown','mouseup','touchstart','touchend','click'])$('stage').addEventListener(type,e=>{if(!isBackCoverRight(e))return;e.stopPropagation();e.preventDefault();if(type==='click'||type==='touchend')next()},{capture:true,passive:false});

document.addEventListener('keydown',e=>{if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;if(['ArrowRight','PageDown'].includes(e.key)){e.preventDefault();next()}if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();prev()}if(e.key==='Home'){e.preventDefault();book.turnToPage(0)}if(e.key==='End'){e.preventDefault();book.turnToPage(leaves.length-1)}});
let timer;window.addEventListener('resize',()=>{clearTimeout(timer);timer=setTimeout(()=>{const index=current, nodes=Array.from(document.querySelectorAll('.leaf'),n=>n.cloneNode(true));book.destroy();const container=document.createElement('div');container.id='book';container.setAttribute('aria-label','Interactive flipbook');$('stage').insertBefore(container,$('right'));nodes.forEach(n=>{n.removeAttribute('style');n.className='leaf';container.append(n)});busy=false;create(index)},180)});
