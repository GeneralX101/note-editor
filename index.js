"use strict";

var Quill = require('quill')
  , Backbone = require('backbone')
  , $ = Backbone.$ = require('jquery')

var keys = {
  BACKSPACE: 8,
  LEFT_ARROW: 37,
  UP_ARROW: 38,
  RIGHT_ARROW: 39,
  DOWN_ARROW: 40
}

function makeSection(data) {
  var section;
  if (data.section_type === 'text') {
    section = new TextSection(data);
  } else if (data.section_type === 'citation') {
    section = new CitationSection(data);
  }
  return section;
}

function init() {
  var collection = new SectionCollection()
    , data = require('./data.json')

  data.forEach(function (sectionData) {
    var section = makeSection(sectionData);
    collection.add(section);
  });

  var view = new SectionCollectionView({
    el: '#sections',
    collection: collection
  });
}

/*
 * Given a parent node, child node, calculate the offset which can be passed
 * to a Quill editor to restore cursor position. Can be passed an offset for
 * child. Without being passed a child, will calculate child and offset using
 * window.getSelection().
 */
function getTextPositionOffset(parent, child, offset) {
  var range = document.createRange()
    , selection
    , contents

  if (!child) {
    selection = window.getSelection();
    child = selection.focusNode || parent;
    offset = selection.focusOffset || 0;
  }

  range.setStart(parent, 0);
  range.setEnd(child, offset);
  contents = range.cloneContents();

  return contents.textContent.trimLeft().length + contents.childNodes.length - 1;
}

function closest(el, className) {
  var currentEl = el
    , foundEl

  while (currentEl) {
    if (currentEl.classList && currentEl.classList.contains(className)) {
      foundEl = currentEl;
      break;
    }
    currentEl = currentEl.parentNode;
  }

  return foundEl;
}

function selectionInTopLine(editor) {
  var text = editor.getText(0, editor.getSelection().start);
  return text.indexOf('\n') === -1;
}

function selectionInBottomLine(editor) {
  var text = editor.getText(editor.getSelection().start).slice(0, -1);
  return text.indexOf('\n') === -1;
}


var Section = Backbone.Model.extend({
  toJSON: function () {
    var ret = Backbone.Model.prototype.toJSON.call(this);
    ret.section_type = this.section_type;
    return ret;
  }
});

var TextSection = Section.extend({
  section_type: 'text',
  defaults: {
    content: null
  }
});

var CitationSection = Section.extend({
  section_type: 'citation',
  defaults: {
    'document': null,
    content: null
  }
});

var SectionCollection = Backbone.Collection.extend({
  model: Section
});

var SectionCollectionView = Backbone.View.extend({
  className: 'sections',
  events: {
    'click .section': 'handleClick',
    'keydown': 'handleKeydown'
  },
  initialize: function () {
    var that = this;

    this.editorBySection = {};
    this.elBySection = {};
    this.render();

    this._updatePre();
    this.collection.on('change', this._updatePre.bind(this));

    document.querySelector('#toolbar').addEventListener('click', function () {
      var section = makeSection({ section_type: 'citation' });
      var focused = window.getSelection().focusNode;
      var currentSection = closest(focused, 'section');
      var idx = null;
      if (currentSection) {
        currentSection = that.collection.get(currentSection.dataset.cid);
        idx = that.collection.indexOf(currentSection) + 1;
      }
      that.collection.add(section, { at: idx });
      that._addSection(section);
      that.elBySection[section.cid].querySelector('input').focus();
    });
  },
  _updatePre: function (collection) {
    $('pre').text(JSON.stringify(this.collection, true, '  '));
  },
  _addSection: function (section) {
    var that = this
      , newEl = $('<div class="section">')
      , idx = this.collection.indexOf(section)
      , before

    newEl[0].dataset.sectionType = section.section_type;
    newEl[0].dataset.cid = section.cid;

    if (section.section_type === 'citation') {
      if (section.has('document') && section.get('document')) {
        newEl.append(
          '<div><a href="#' + section.get('document') + '">' +
          section.get('document_description') + '</a></div>')
      } else {
        newEl.append(
          '<div><input type="text" placeholder="Document title"></input> ' +
          '<button>OK</button></div>')
        newEl.find('button').one('click', function () {
          var $parent = $(this.parentNode);
          var val = $parent.find('input').val();
          section.set('document_description', val);
          section.set('document', 'http://example.com/' + Math.random());
          $(this.parentNode).replaceWith(
            '<div><a href="#' + section.get('document') + '">' +
            section.get('document_description') + '</a></div>')
          that.switchToSection(section, true, 0);
        });
      }
    }

    newEl.append('<div class="content">' + (section.get('content') || '') + '</div>');
    this.elBySection[section.cid] = newEl[0];

    if (idx === 0) {
      this.$el.prepend(newEl);
    } else {
      newEl.insertAfter(this.elBySection[this.collection.at(idx - 1).cid]);
    }
  },
  render: function () {
    this.collection.forEach(this._addSection, this);
  },
  _sectionForEl: function (el) {
    var sectionEl = closest(el, 'section')
      , cid

    if (!sectionEl) throw new Error('Element ' + el + ' is not within a section.');

    cid = sectionEl.dataset.cid;
    return this.collection.get(cid);
  },
  makeEditor: function (section) {
    var el
      , editor

    section = typeof section !== 'object' ? this.collection.get(section) : section;

    el = this.elBySection[section.cid]
    editor = new Quill(el.querySelector('.content'), {
      pollInterval: 1000,
      styles: false
    });

    editor.on('text-change', function () {
      section.set('content', editor.getHTML());
    });

    this.editorBySection[section.cid] = editor;
    return editor;
  },
  handleClick: function (e) {
    var sectionEl = closest(e.target, 'section')
      , editor
      , offset

    if (sectionEl.dataset.noEdit) return;
    if (sectionEl.classList.contains('editing')) return;
    if (e.target.nodeName === 'INPUT') return;

    offset = getTextPositionOffset(sectionEl.querySelector('.content'));
    editor = this.makeEditor(sectionEl.dataset.cid);

    if (offset < 0) offset = 0;
    editor.setSelection(offset, offset);

    sectionEl.classList.add('editing');
  },
  handleKeydown: function (e) {
    var curSection
      , editor
      , idx
      , lineOffset

    switch (e.which) {
    case (keys.LEFT_ARROW):
      break;
    case (keys.RIGHT_ARROW):
      break;
    case (keys.UP_ARROW):
      curSection = this._sectionForEl(e.target);
      editor = this.editorBySection[curSection.cid];
      if (selectionInTopLine(editor)) {
        idx = this.collection.indexOf(curSection);
        if (idx === 0) break;
        lineOffset = editor.getSelection().start;
        editor.setSelection(null);
        this.switchToSection(this.collection.at(idx -1), false, lineOffset);
      }
      break;
    case (keys.DOWN_ARROW):
      curSection = this._sectionForEl(e.target);
      editor = this.editorBySection[curSection.cid];
      if (selectionInBottomLine(editor)) {
        idx = this.collection.indexOf(curSection);
        if (idx === this.collection.length - 1) break;
        var lastLine = getLine(editor, false);
        lineOffset = getLine(editor, false).length
          - (editor.getLength() - 1 - editor.getSelection().start)
        editor.setSelection(null);
        this.switchToSection(this.collection.at(idx + 1), true, lineOffset);
      }
      break;
    default:
      break;
    }
  },
  switchToSection: function (section, toTop, lineOffset) {
    var editor = this.editorBySection[section.cid] || this.makeEditor(section)
      , line
      , offset
      , length

    if (toTop) {
      line = getLine(editor, true);
      offset = lineOffset > line.length ? line.length : lineOffset;
    } else {
      line = getLine(editor, false);
      length = editor.getLength();
      offset = lineOffset > line.length ? length - 1 : length - line.length + lineOffset - 1;
    }

    setTimeout(function () {
      editor.setSelection(offset, offset);
    }, 0);
  }
});

function getLine(editor, isTop) {
  var lines = editor.getContents().ops
    .map(function (op) { return op.insert })
    .join('')
    .split('\n')

  return isTop ? lines[0] : lines[lines.length - 2]
}

init();
