var keys = {
  BACKSPACE: 8,
  ENTER: 13,

  LEFT_ARROW: 37,
  UP_ARROW: 38,
  RIGHT_ARROW: 39,
  DOWN_ARROW: 40
}

function Spacer(quill, options) {
  this.editor = quill;

  this.firstLine = null;
  this.lastLine = null;
  this.firstZeroSpace = document.createTextNode('\u200B');
  this.lastZeroSpace = document.createTextNode('\u200B');

  this.refreshZeroSpaces();
  this.editor.root.addEventListener('keydown', this.onkeydown.bind(this));
  //this.editor.getLine = this.getLine.bind(this);
}

Spacer.prototype.refreshZeroSpaces = function () {
  var firstLine = this.editor.editor.doc.lines.first.node;

  this.editor.root.insertBefore(document.createTextNode('\u200B'), firstLine)
  this.editor.root.appendChild(document.createTextNode('\u200B'), firstLine)


  /*
  if (this.firstLine !== firstLine) {
    this.firstLine = firstLine;
    this.firstLine.insertBefore(this.firstZeroSpace, this.firstLine.childNodes[0])
  }

  if (this.lastLine !== lastLine) {
    this.lastLine = lastLine;
    if (this.lastLine === this.firstLine) {
      childNodes = this.lastLine.childNodes;
      this.firstLine.insertBefore(this.lastZeroSpace, childNodes[childNodes.length - 1]);
    } else {
      this.lastLine.appendChild(this.lastZeroSpace);
    }
  }
  */
}

Spacer.prototype.onkeydown = function (e) {
  var lineOffset
    , lastLine

  switch (e.which) {
    case (keys.UP_ARROW):
      if (this.selectionInTopLine()) {
        lineOffset = this.editor.getSelection().start;
        this.editor.emit('up-on-top-line', lineOffset, e);
      }
      break;
    case (keys.DOWN_ARROW):
      if (this.selectionInBottomLine()) {
        lineOffset = this.getLine(-1).length
          - (this.editor.getLength() - 1 - this.editor.getSelection().start)
        this.editor.emit('down-on-bottom-line', lineOffset, e);
      }
      break;
    case (keys.LEFT_ARROW):
      if (this.selectionAtTopLeft()) {
        console.log('left');
        this.editor.emit('left-at-origin', e);
      }
      break;
    case (keys.RIGHT_ARROW):
      if (this.selectionAtBottomRight()) {
        console.log('right');
        this.editor.emit('right-at-terminus', e);
      }
      break;
    default:
      break;
  }

  return true;
}

Spacer.prototype.getLine = function (index) {
  var lines = this.editor.getContents().ops
    .map(function (op) { return op.insert })
    .join('')
    .split('\n')

  return index > -1 ? lines[index] : lines[lines.length + (index - 1)];
}

Spacer.prototype.selectionAtTopLeft = function () {
  var selection = this.editor.getSelection();
  return selection.start === 0 && selection.end === 0;
}

Spacer.prototype.selectionAtBottomRight = function () {
  var length = this.editor.getLength()
    , selection = this.editor.getSelection()

  return selection.start === length - 1 && selection.end === length - 1;
}

Spacer.prototype.selectionInTopLine = function () {
  var text = this.editor.getText(0, this.editor.getSelection().end);
  return text.indexOf('\n') === -1;
}

Spacer.prototype.selectionInBottomLine = function () {
  var text = this.editor.getText(this.editor.getSelection().start).slice(0, -1);
  return text.indexOf('\n') === -1;
}

module.exports = Spacer;
