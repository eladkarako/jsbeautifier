/*jshint curly:true, eqeqeq:true, laxbreak:true, noempty:false */
/*

  The MIT License (MIT)

  Copyright (c) 2007-2017 Einar Lielmanis, Liam Newman, and contributors.

  Permission is hereby granted, free of charge, to any person
  obtaining a copy of this software and associated documentation files
  (the "Software"), to deal in the Software without restriction,
  including without limitation the rights to use, copy, modify, merge,
  publish, distribute, sublicense, and/or sell copies of the Software,
  and to permit persons to whom the Software is furnished to do so,
  subject to the following conditions:

  The above copyright notice and this permission notice shall be
  included in all copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
  NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS
  BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN
  ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
  CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.
*/

var mergeOpts = require('core/options').mergeOpts;
var acorn = require('core/acorn');


var lineBreak = acorn.lineBreak;
var allLineBreaks = acorn.allLineBreaks;

// function trim(s) {
//     return s.replace(/^\s+|\s+$/g, '');
// }

function ltrim(s) {
  return s.replace(/^\s+/g, '');
}

function rtrim(s) {
  return s.replace(/\s+$/g, '');
}

function Beautifier(html_source, options, js_beautify, css_beautify) {
  //Wrapper function to invoke all the necessary constructors and deal with the output.
  html_source = html_source || '';
  options = options || {};

  var multi_parser,
    indent_inner_html,
    indent_body_inner_html,
    indent_head_inner_html,
    indent_size,
    indent_character,
    wrap_line_length,
    brace_style,
    inline_tags,
    unformatted,
    content_unformatted,
    preserve_newlines,
    max_preserve_newlines,
    indent_handlebars,
    wrap_attributes,
    wrap_attributes_indent_size,
    is_wrap_attributes_force,
    is_wrap_attributes_force_expand_multiline,
    is_wrap_attributes_force_aligned,
    is_wrap_attributes_aligned_multiple,
    end_with_newline,
    extra_liners,
    eol;

  // Allow the setting of language/file-type specific options
  // with inheritance of overall settings
  options = mergeOpts(options, 'html');

  // backwards compatibility to 1.3.4
  if ((options.wrap_line_length === undefined || parseInt(options.wrap_line_length, 10) === 0) &&
    (options.max_char !== undefined && parseInt(options.max_char, 10) !== 0)) {
    options.wrap_line_length = options.max_char;
  }

  indent_inner_html = (options.indent_inner_html === undefined) ? false : options.indent_inner_html;
  indent_body_inner_html = (options.indent_body_inner_html === undefined) ? true : options.indent_body_inner_html;
  indent_head_inner_html = (options.indent_head_inner_html === undefined) ? true : options.indent_head_inner_html;
  indent_size = (options.indent_size === undefined) ? 4 : parseInt(options.indent_size, 10);
  indent_character = (options.indent_char === undefined) ? ' ' : options.indent_char;
  brace_style = (options.brace_style === undefined) ? 'collapse' : options.brace_style;
  wrap_line_length = parseInt(options.wrap_line_length, 10) === 0 ? 32786 : parseInt(options.wrap_line_length || 250, 10);
  inline_tags = options.inline || [
    // https://www.w3.org/TR/html5/dom.html#phrasing-content
    'a', 'abbr', 'area', 'audio', 'b', 'bdi', 'bdo', 'br', 'button', 'canvas', 'cite',
    'code', 'data', 'datalist', 'del', 'dfn', 'em', 'embed', 'i', 'iframe', 'img',
    'input', 'ins', 'kbd', 'keygen', 'label', 'map', 'mark', 'math', 'meter', 'noscript',
    'object', 'output', 'progress', 'q', 'ruby', 's', 'samp', /* 'script', */ 'select', 'small',
    'span', 'strong', 'sub', 'sup', 'svg', 'template', 'textarea', 'time', 'u', 'var',
    'video', 'wbr', 'text',
    // prexisting - not sure of full effect of removing, leaving in
    'acronym', 'address', 'big', 'dt', 'ins', 'strike', 'tt',
  ];
  unformatted = options.unformatted || [];
  content_unformatted = options.content_unformatted || [
    'pre', 'textarea'
  ];
  preserve_newlines = (options.preserve_newlines === undefined) ? true : options.preserve_newlines;
  max_preserve_newlines = preserve_newlines ?
    (isNaN(parseInt(options.max_preserve_newlines, 10)) ? 32786 : parseInt(options.max_preserve_newlines, 10)) :
    0;
  indent_handlebars = (options.indent_handlebars === undefined) ? false : options.indent_handlebars;
  wrap_attributes = (options.wrap_attributes === undefined) ? 'auto' : options.wrap_attributes;
  wrap_attributes_indent_size = (isNaN(parseInt(options.wrap_attributes_indent_size, 10))) ? indent_size : parseInt(options.wrap_attributes_indent_size, 10);
  is_wrap_attributes_force = wrap_attributes.substr(0, 'force'.length) === 'force';
  is_wrap_attributes_force_expand_multiline = (wrap_attributes === 'force-expand-multiline');
  is_wrap_attributes_force_aligned = (wrap_attributes === 'force-aligned');
  is_wrap_attributes_aligned_multiple = (wrap_attributes === 'aligned-multiple');
  end_with_newline = (options.end_with_newline === undefined) ? false : options.end_with_newline;
  extra_liners = (typeof options.extra_liners === 'object') && options.extra_liners ?
    options.extra_liners.concat() : (typeof options.extra_liners === 'string') ?
    options.extra_liners.split(',') : 'head,body,/html'.split(',');
  eol = options.eol ? options.eol : 'auto';

  if (options.indent_with_tabs) {
    indent_character = '\t';
    indent_size = 1;
  }

  if (eol === 'auto') {
    eol = '\n';
    if (html_source && lineBreak.test(html_source || '')) {
      eol = html_source.match(lineBreak)[0];
    }
  }

  eol = eol.replace(/\\r/, '\r').replace(/\\n/, '\n');

  // HACK: newline parsing inconsistent. This brute force normalizes the input.
  html_source = html_source.replace(allLineBreaks, '\n');

  function Parser() {

    this.pos = 0; //Parser position
    this.token = '';
    this.current_mode = 'CONTENT'; //reflects the current Parser mode: TAG/CONTENT
    this.tags = { //An object to hold tags, their position, and their parent-tags, initiated with default values
      parent: 'parent1',
      parentcount: 1,
      parent1: ''
    };
    this.last_token = {
      text: '',
      type: ''
    };
    this.token_text = '';
    this.newlines = 0;
    this.indent_content = indent_inner_html;
    this.indent_body_inner_html = indent_body_inner_html;
    this.indent_head_inner_html = indent_head_inner_html;

    this.Utils = { //Uilities made available to the various functions
      whitespace: "\n\r\t ".split(''),

      single_token: options.void_elements || [
        // HTLM void elements - aka self-closing tags - aka singletons
        // https://www.w3.org/html/wg/drafts/html/master/syntax.html#void-elements
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'keygen',
        'link', 'menuitem', 'meta', 'param', 'source', 'track', 'wbr',
        // NOTE: Optional tags - are not understood.
        // https://www.w3.org/TR/html5/syntax.html#optional-tags
        // The rules for optional tags are too complex for a simple list
        // Also, the content of these tags should still be indented in many cases.
        // 'li' is a good exmple.

        // Doctype and xml elements
        '!doctype', '?xml',
        // ?php and ?= tags
        '?php', '?=',
        // other tags that were in this list, keeping just in case
        'basefont', 'isindex'
      ],
      extra_liners: extra_liners, //for tags that need a line of whitespace before them
      in_array: function(what, arr) {
        for (var i = 0; i < arr.length; i++) {
          if (what === arr[i]) {
            return true;
          }
        }
        return false;
      },
    };

    // Return true if the given text is composed entirely of whitespace.
    this.is_whitespace = function(text) {
      for (var n = 0; n < text.length; n++) {
        if (!this.Utils.in_array(text.charAt(n), this.Utils.whitespace)) {
          return false;
        }
      }
      return true;
    };

    this.traverse_whitespace = function() {
      var input_char = '';

      input_char = this.input.charAt(this.pos);
      if (this.Utils.in_array(input_char, this.Utils.whitespace)) {
        this.newlines = 0;
        while (this.Utils.in_array(input_char, this.Utils.whitespace)) {
          if (preserve_newlines && input_char === '\n' && this.newlines <= max_preserve_newlines) {
            this.newlines += 1;
          }

          this.pos++;
          input_char = this.input.charAt(this.pos);
        }
        return true;
      }
      return false;
    };

    // Append a space to the given content (string array) or, if we are
    // at the wrap_line_length, append a newline/indentation.
    // return true if a newline was added, false if a space was added
    this.space_or_wrap = function(content) {
      if (this.line_char_count >= this.wrap_line_length) { //insert a line when the wrap_line_length is reached
        this.print_newline(false, content);
        this.print_indentation(content);
        return true;
      } else {
        this.line_char_count++;
        content.push(' ');
        return false;
      }
    };

    this.get_content = function() { //function to capture regular content between tags
      var input_char = '',
        token = {
          text: '',
          type: 'TK_CONTENT'
        },
        content = [],
        handlebarsStarted = 0;

      while (this.input.charAt(this.pos) !== '<' || handlebarsStarted === 2) {
        if (this.pos >= this.input.length) {
          if (!content.length) {
            token.type = 'TK_EOF';
          }
          break;
        }

        if (handlebarsStarted < 2 && this.traverse_whitespace()) {
          this.space_or_wrap(content);
          continue;
        }

        input_char = this.input.charAt(this.pos);

        if (indent_handlebars) {
          if (input_char === '{') {
            handlebarsStarted += 1;
          } else if (handlebarsStarted < 2) {
            handlebarsStarted = 0;
          }

          if (input_char === '}' && handlebarsStarted > 0) {
            if (handlebarsStarted-- === 0) {
              break;
            }
          }
          // Handlebars parsing is complicated.
          // {{#foo}} and {{/foo}} are formatted tags.
          // {{something}} should get treated as content, except:
          // {{else}} specifically behaves like {{#if}} and {{/if}}
          var peek3 = this.input.substr(this.pos, 3);
          if (peek3 === '{{#' || peek3 === '{{/') {
            // These are tags and not content.
            break;
          } else if (peek3 === '{{!') {
            token = this.get_tag();
            token.type = 'TK_TAG_HANDLEBARS_COMMENT';
            return token;
          } else if (this.input.substr(this.pos, 2) === '{{') {
            if (this.get_tag(true).text === '{{else}}') {
              break;
            }
          }
        }

        this.pos++;
        this.line_char_count++;
        content.push(input_char); //letter at-a-time (or string) inserted to an array
      }
      token.text = content.join('');
      return token;
    };

    this.get_contents_to = function(name) { //get the full content of a script or style to pass to js_beautify
      if (this.pos === this.input.length) {
        return { text: '', type: 'TK_EOF' };
      }
      var content = '';
      var reg_match = new RegExp('</' + name + '\\s*>', 'igm');
      reg_match.lastIndex = this.pos;
      var reg_array = reg_match.exec(this.input);
      var end_script = reg_array ? reg_array.index : this.input.length; //absolute end of script
      if (this.pos < end_script) { //get everything in between the script tags
        content = this.input.substring(this.pos, end_script);
        this.pos = end_script;
      }
      return { text: content, type: 'TK_' + name };
    };

    this.record_tag = function(tag) { //function to record a tag and its parent in this.tags Object
      if (this.tags[tag + 'count']) { //check for the existence of this tag type
        this.tags[tag + 'count']++;
        this.tags[tag + this.tags[tag + 'count']] = this.indent_level; //and record the present indent level
      } else { //otherwise initialize this tag type
        this.tags[tag + 'count'] = 1;
        this.tags[tag + this.tags[tag + 'count']] = this.indent_level; //and record the present indent level
      }
      this.tags[tag + this.tags[tag + 'count'] + 'parent'] = this.tags.parent; //set the parent (i.e. in the case of a div this.tags.div1parent)
      this.tags.parent = tag + this.tags[tag + 'count']; //and make this the current parent (i.e. in the case of a div 'div1')
    };

    this.retrieve_tag = function(tag) { //function to retrieve the opening tag to the corresponding closer
      if (this.tags[tag + 'count']) { //if the openener is not in the Object we ignore it
        var temp_parent = this.tags.parent; //check to see if it's a closable tag.
        while (temp_parent) { //till we reach '' (the initial value);
          if (tag + this.tags[tag + 'count'] === temp_parent) { //if this is it use it
            break;
          }
          temp_parent = this.tags[temp_parent + 'parent']; //otherwise keep on climbing up the DOM Tree
        }
        if (temp_parent) { //if we caught something
          this.indent_level = this.tags[tag + this.tags[tag + 'count']]; //set the indent_level accordingly
          this.tags.parent = this.tags[temp_parent + 'parent']; //and set the current parent
        }
        delete this.tags[tag + this.tags[tag + 'count'] + 'parent']; //delete the closed tags parent reference...
        delete this.tags[tag + this.tags[tag + 'count']]; //...and the tag itself
        if (this.tags[tag + 'count'] === 1) {
          delete this.tags[tag + 'count'];
        } else {
          this.tags[tag + 'count']--;
        }
      }
    };

    this.indent_to_tag = function(tag) {
      // Match the indentation level to the last use of this tag, but don't remove it.
      if (!this.tags[tag + 'count']) {
        return;
      }
      var temp_parent = this.tags.parent;
      while (temp_parent) {
        if (tag + this.tags[tag + 'count'] === temp_parent) {
          break;
        }
        temp_parent = this.tags[temp_parent + 'parent'];
      }
      if (temp_parent) {
        this.indent_level = this.tags[tag + this.tags[tag + 'count']];
      }
    };

    this.get_tag = function(peek) { //function to get a full tag and parse its type
      var input_char = '',
        token = {
          text: '',
          type: '',
          tag_type: '',
          tag_name: '',
          is_inline_tag: false,
          is_opening_tag: false,
          is_closing_tag: false
        },
        content = [],
        comment = '',
        space = false,
        first_attr = true,
        has_wrapped_attrs = false,
        tag_start, tag_end,
        tag_start_char,
        orig_pos = this.pos,
        orig_line_char_count = this.line_char_count,
        is_tag_closed = false,
        tail;

      peek = peek !== undefined ? peek : false;

      do {
        if (this.pos >= this.input.length) {
          if (peek) {
            this.pos = orig_pos;
            this.line_char_count = orig_line_char_count;
          }
          if (content.length) {
            token.text = content.join('');
          } else {
            token.type = 'TK_EOF';
          }

          return token;
        }

        input_char = this.input.charAt(this.pos);
        this.pos++;

        if (this.Utils.in_array(input_char, this.Utils.whitespace)) { //don't want to insert unnecessary space
          space = true;
          continue;
        }

        if (input_char === "'" || input_char === '"') {
          input_char += this.get_unformatted(input_char);
          space = true;
        }

        if (input_char === '=') { //no space before =
          space = false;
        }
        tail = this.input.substr(this.pos - 1);
        if (is_wrap_attributes_force_expand_multiline && has_wrapped_attrs && !is_tag_closed && (input_char === '>' || input_char === '/')) {
          if (tail.match(/^\/?\s*>/)) {
            space = false;
            is_tag_closed = true;
            this.print_newline(false, content);
            this.print_indentation(content);
          }
        }
        if (content.length && content[content.length - 1] !== '=' && input_char !== '>' && space) {
          //no space after = or before >
          var wrapped = this.space_or_wrap(content);
          var indentAttrs = wrapped && input_char !== '/' && !is_wrap_attributes_force;
          space = false;

          if (is_wrap_attributes_force && input_char !== '/') {
            var force_first_attr_wrap = false;
            if (is_wrap_attributes_force_expand_multiline && first_attr) {
              var is_only_attribute = tail.match(/^\S*(="([^"]|\\")*")?\s*\/?\s*>/) !== null;
              force_first_attr_wrap = !is_only_attribute;
            }
            if (!first_attr || force_first_attr_wrap) {
              this.print_newline(false, content);
              this.print_indentation(content);
              indentAttrs = true;
            }
          }
          if (indentAttrs) {
            has_wrapped_attrs = true;

            //indent attributes an auto, forced, aligned or forced-align line-wrap
            var alignment_size = wrap_attributes_indent_size;
            if (is_wrap_attributes_force_aligned || is_wrap_attributes_aligned_multiple) {
              alignment_size = content.indexOf(' ') + 1;
            }

            for (var count = 0; count < alignment_size; count++) {
              // only ever further indent with spaces since we're trying to align characters
              content.push(' ');
            }
          }
          if (first_attr) {
            for (var i = 0; i < content.length; i++) {
              if (content[i] === ' ') {
                first_attr = false;
                break;
              }
            }
          }
        }

        if (indent_handlebars && tag_start_char === '<') {
          // When inside an angle-bracket tag, put spaces around
          // handlebars not inside of strings.
          if ((input_char + this.input.charAt(this.pos)) === '{{') {
            input_char += this.get_unformatted('}}');
            if (content.length && content[content.length - 1] !== ' ' && content[content.length - 1] !== '<') {
              input_char = ' ' + input_char;
            }
            space = true;
          }
        }

        if (input_char === '<' && !tag_start_char) {
          tag_start = this.pos - 1;
          tag_start_char = '<';
        }

        if (indent_handlebars && !tag_start_char) {
          if (content.length >= 2 && content[content.length - 1] === '{' && content[content.length - 2] === '{') {
            if (input_char === '#' || input_char === '/' || input_char === '!') {
              tag_start = this.pos - 3;
            } else {
              tag_start = this.pos - 2;
            }
            tag_start_char = '{';
          }
        }

        this.line_char_count++;
        content.push(input_char); //inserts character at-a-time (or string)

        if (content[1] && (content[1] === '!' || content[1] === '?' || content[1] === '%')) { //if we're in a comment, do something special
          // We treat all comments as literals, even more than preformatted tags
          // we just look for the appropriate close tag
          content = [this.get_comment(tag_start)];
          break;
        }

        if (indent_handlebars && content[1] && content[1] === '{' && content[2] && content[2] === '!') { //if we're in a comment, do something special
          // We treat all comments as literals, even more than preformatted tags
          // we just look for the appropriate close tag
          content = [this.get_comment(tag_start)];
          break;
        }

        if (indent_handlebars && tag_start_char === '{' && content.length > 2 && content[content.length - 2] === '}' && content[content.length - 1] === '}') {
          break;
        }
      } while (input_char !== '>');

      var tag_complete = content.join('');
      var tag_index;
      var tag_offset;

      // must check for space first otherwise the tag could have the first attribute included, and
      // then not un-indent correctly
      if (tag_complete.search(/\s/) !== -1) { //if there's whitespace, thats where the tag name ends
        tag_index = tag_complete.search(/\s/);
      } else if (tag_complete.charAt(0) === '{') {
        tag_index = tag_complete.indexOf('}');
      } else { //otherwise go with the tag ending
        tag_index = tag_complete.indexOf('>');
      }
      if (tag_complete.charAt(0) === '<' || !indent_handlebars) {
        tag_offset = 1;
      } else {
        tag_offset = tag_complete.charAt(2) === '#' ? 3 : 2;
      }
      var tag_check = tag_complete.substring(tag_offset, tag_index).toLowerCase();
      token.is_closing_tag = tag_check.charAt(0) === '/';
      token.tag_name = token.is_closing_tag ? tag_check.substr(1) : tag_check;
      token.is_inline_tag = this.Utils.in_array(token.tag_name, inline_tags);


      if (tag_complete.charAt(tag_complete.length - 2) === '/' ||
        this.Utils.in_array(tag_check, this.Utils.single_token)) { //if this tag name is a single tag type (either in the list or has a closing /)
        token.tag_type = 'SINGLE';
        token.is_closing_tag = true;
      } else if (indent_handlebars && tag_complete.charAt(0) === '{' && tag_check === 'else') {
        if (!peek) {
          this.indent_to_tag('if');
          token.tag_type = 'HANDLEBARS_ELSE';
          this.indent_content = true;
          this.traverse_whitespace();
        }
      } else if (this.Utils.in_array(tag_check, unformatted) ||
        this.Utils.in_array(tag_check, content_unformatted)) {
        // do not reformat the "unformatted" or "content_unformatted" tags
        if (this.Utils.in_array(tag_check, unformatted)) {
          content = [this.input.slice(tag_start, this.pos)];
        }
        comment = this.get_unformatted('</' + tag_check + '>', tag_complete); //...delegate to get_unformatted function
        content.push(comment);
        tag_end = this.pos - 1;
        token.tag_type = 'SINGLE';
        token.is_closing_tag = true;
      } else if (tag_check === 'script' &&
        (tag_complete.search('type') === -1 ||
          (tag_complete.search('type') > -1 &&
            tag_complete.search(/\b(text|application|dojo)\/(x-)?(javascript|ecmascript|jscript|livescript|(ld\+)?json|method|aspect)/) > -1))) {
        if (!peek) {
          this.record_tag(tag_check);
          token.tag_type = 'SCRIPT';
        }
      } else if (tag_check === 'style' &&
        (tag_complete.search('type') === -1 ||
          (tag_complete.search('type') > -1 && tag_complete.search('text/css') > -1))) {
        if (!peek) {
          this.record_tag(tag_check);
          token.tag_type = 'STYLE';
        }
      } else if (tag_check.charAt(0) === '!') { //peek for <! comment
        // for comments content is already correct.
        if (!peek) {
          token.tag_type = 'SINGLE';
          this.traverse_whitespace();
        }
      } else if (!peek) {
        if (token.is_closing_tag) { //this tag is a double tag so check for tag-ending
          this.retrieve_tag(tag_check.substring(1)); //remove it and all ancestors
          token.tag_type = 'END';
        } else { //otherwise it's a start-tag
          this.record_tag(tag_check); //push it on the tag stack
          if (tag_check.toLowerCase() !== 'html') {
            this.indent_content = true;
          }
          token.tag_type = 'START';
          token.is_opening_tag = true;
        }

        // Allow preserving of newlines after a start or end tag
        if (this.traverse_whitespace()) {
          this.space_or_wrap(content);
        }

        if (this.Utils.in_array(tag_check, this.Utils.extra_liners)) { //check if this double needs an extra line
          this.print_newline(false, this.output);
          if (this.output.length && this.output[this.output.length - 2] !== '\n') {
            this.print_newline(true, this.output);
          }
        }
      }

      if (peek) {
        this.pos = orig_pos;
        this.line_char_count = orig_line_char_count;
      }

      token.text = content.join('');
      token.type = 'TK_TAG_' + token.tag_type;

      return token; //returns fully formatted tag
    };

    this.get_comment = function(start_pos) { //function to return comment content in its entirety
      // this is will have very poor perf, but will work for now.
      var comment = '',
        delimiter = '>',
        matched = false;

      this.pos = start_pos;
      var input_char = this.input.charAt(this.pos);
      this.pos++;

      while (this.pos <= this.input.length) {
        comment += input_char;

        // only need to check for the delimiter if the last chars match
        if (comment.charAt(comment.length - 1) === delimiter.charAt(delimiter.length - 1) &&
          comment.indexOf(delimiter) !== -1) {
          break;
        }

        // only need to search for custom delimiter for the first few characters
        if (!matched) {
          matched = comment.length > 10;
          if (comment.indexOf('<![if') === 0) { //peek for <![if conditional comment
            delimiter = '<![endif]>';
            matched = true;
          } else if (comment.indexOf('<![cdata[') === 0) { //if it's a <[cdata[ comment...
            delimiter = ']]>';
            matched = true;
          } else if (comment.indexOf('<![') === 0) { // some other ![ comment? ...
            delimiter = ']>';
            matched = true;
          } else if (comment.indexOf('<!--') === 0) { // <!-- comment ...
            delimiter = '-->';
            matched = true;
          } else if (comment.indexOf('{{!--') === 0) { // {{!-- handlebars comment
            delimiter = '--}}';
            matched = true;
          } else if (comment.indexOf('{{!') === 0) { // {{! handlebars comment
            if (comment.length === 5 && comment.indexOf('{{!--') === -1) {
              delimiter = '}}';
              matched = true;
            }
          } else if (comment.indexOf('<?') === 0) { // {{! handlebars comment
            delimiter = '?>';
            matched = true;
          } else if (comment.indexOf('<%') === 0) { // {{! handlebars comment
            delimiter = '%>';
            matched = true;
          }
        }

        input_char = this.input.charAt(this.pos);
        this.pos++;
      }

      return comment;
    };

    function tokenMatcher(delimiter) {
      var token = '';

      var add = function(str) {
        var newToken = token + str.toLowerCase();
        token = newToken.length <= delimiter.length ? newToken : newToken.substr(newToken.length - delimiter.length, delimiter.length);
      };

      var doesNotMatch = function() {
        return token.indexOf(delimiter) === -1;
      };

      return {
        add: add,
        doesNotMatch: doesNotMatch
      };
    }

    this.get_unformatted = function(delimiter, orig_tag) { //function to return unformatted content in its entirety
      if (orig_tag && orig_tag.toLowerCase().indexOf(delimiter) !== -1) {
        return '';
      }
      var input_char = '';
      var content = '';
      var space = true;

      var delimiterMatcher = tokenMatcher(delimiter);

      do {

        if (this.pos >= this.input.length) {
          return content;
        }

        input_char = this.input.charAt(this.pos);
        this.pos++;

        if (this.Utils.in_array(input_char, this.Utils.whitespace)) {
          if (!space) {
            this.line_char_count--;
            continue;
          }
          if (input_char === '\n' || input_char === '\r') {
            content += '\n';
            /*  Don't change tab indention for unformatted blocks.  If using code for html editing, this will greatly affect <pre> tags if they are specified in the 'unformatted array'
            for (var i=0; i<this.indent_level; i++) {
              content += this.indent_string;
            }
            space = false; //...and make sure other indentation is erased
            */
            this.line_char_count = 0;
            continue;
          }
        }
        content += input_char;
        delimiterMatcher.add(input_char);
        this.line_char_count++;
        space = true;

        if (indent_handlebars && input_char === '{' && content.length && content.charAt(content.length - 2) === '{') {
          // Handlebars expressions in strings should also be unformatted.
          content += this.get_unformatted('}}');
          // Don't consider when stopping for delimiters.
        }
      } while (delimiterMatcher.doesNotMatch());

      return content;
    };

    this.get_token = function() { //initial handler for token-retrieval
      var token;
      if (this.last_token.type === 'TK_TAG_SCRIPT' || this.last_token.type === 'TK_TAG_STYLE') { //check if we need to format javascript
        var type = this.last_token.type.substr(7);
        token = this.get_contents_to(type);
      } else if (this.current_mode === 'CONTENT') {
        token = this.get_content();
      } else if (this.current_mode === 'TAG') {
        token = this.get_tag();
      }
      return token;
    };

    this.get_full_indent = function(level) {
      level = this.indent_level + level || 0;
      if (level < 1) {
        return '';
      }

      return Array(level + 1).join(this.indent_string);
    };

    this.printer = function(js_source, indent_character, indent_size, wrap_line_length, brace_style) { //handles input/output and some other printing functions

      this.input = js_source || ''; //gets the input for the Parser

      // HACK: newline parsing inconsistent. This brute force normalizes the input.
      this.input = this.input.replace(/\r\n|[\r\u2028\u2029]/g, '\n');

      this.output = [];
      this.indent_character = indent_character;
      this.indent_string = '';
      this.indent_size = indent_size;
      this.brace_style = brace_style;
      this.indent_level = 0;
      this.wrap_line_length = wrap_line_length;
      this.line_char_count = 0; //count to see if wrap_line_length was exceeded

      for (var i = 0; i < this.indent_size; i++) {
        this.indent_string += this.indent_character;
      }

      this.print_newline = function(force, arr) {
        if (!arr || !arr.length) {
          return;
        }
        if (force || (arr[arr.length - 1] !== '\n')) { //we might want the extra line
          this.line_char_count = 0;
          if ((arr[arr.length - 1] !== '\n')) {
            arr[arr.length - 1] = rtrim(arr[arr.length - 1]);
          }
          arr.push('\n');
        }
      };

      this.print_indentation = function(arr) {
        for (var i = 0; i < this.indent_level; i++) {
          arr.push(this.indent_string);
          this.line_char_count += this.indent_string.length;
        }
      };

      this.print_token = function(text) {
        // Avoid printing initial whitespace.
        if (this.is_whitespace(text) && !this.output.length) {
          return;
        }
        if (text || text !== '') {
          if (this.output.length && this.output[this.output.length - 1] === '\n') {
            this.print_indentation(this.output);
            text = ltrim(text);
          }
        }
        this.print_token_raw(text);
      };

      this.print_token_raw = function(text) {
        // If we are going to print newlines, truncate trailing
        // whitespace, as the newlines will represent the space.
        if (this.newlines > 0) {
          text = rtrim(text);
        }

        if (text && text !== '') {
          if (text.length > 1 && text.charAt(text.length - 1) === '\n') {
            // unformatted tags can grab newlines as their last character
            this.output.push(text.slice(0, -1));
            this.print_newline(false, this.output);
          } else {
            this.output.push(text);
          }
        }

        for (var n = 0; n < this.newlines; n++) {
          this.print_newline(n > 0, this.output);
        }
        this.newlines = 0;
      };

      this.indent = function() {
        this.indent_level++;
      };

      this.unindent = function() {
        if (this.indent_level > 0) {
          this.indent_level--;
        }
      };
    };
    return this;
  }

  /*_____________________--------------------_____________________*/

  this.beautify = function() {
    multi_parser = new Parser(); //wrapping functions Parser
    multi_parser.printer(html_source, indent_character, indent_size, wrap_line_length, brace_style); //initialize starting values
    var token = null;
    var last_tag_token = {
      text: '',
      type: '',
      tag_name: '',
      is_opening_tag: false,
      is_closing_tag: false,
      is_inline_tag: false
    };
    while (true) {
      token = multi_parser.get_token();

      if (token.type === 'TK_EOF') {
        break;
      }

      switch (token.type) {
        case 'TK_TAG_START':
          if (!last_tag_token.is_inline_tag && !token.is_inline_tag) {
            multi_parser.print_newline(false, multi_parser.output);
          }
          multi_parser.print_token(token.text);
          if (multi_parser.indent_content) {
            if ((multi_parser.indent_body_inner_html || token.tag_name !== 'body') &&
              (multi_parser.indent_head_inner_html || token.tag_name !== 'head')) {

              multi_parser.indent();
            }

            multi_parser.indent_content = false;
          }
          last_tag_token = token;
          multi_parser.current_mode = 'CONTENT';
          break;
        case 'TK_TAG_STYLE':
        case 'TK_TAG_SCRIPT':
          multi_parser.print_newline(false, multi_parser.output);
          multi_parser.print_token(token.text);
          last_tag_token = token;
          multi_parser.current_mode = 'CONTENT';
          break;
        case 'TK_TAG_END':
          if (!token.is_inline_tag) {
            //Print new line only if the tag has no content and has child
            if (!(!last_tag_token.is_closing_tag &&
                token.tag_name === last_tag_token.tag_name &&
                !multi_parser.Utils.in_array(token.tag_name, content_unformatted)
              ) &&
              !last_tag_token.is_inline_tag
            ) {
              multi_parser.print_newline(false, multi_parser.output);
            }
          }
          multi_parser.print_token(token.text);
          last_tag_token = token;
          multi_parser.current_mode = 'CONTENT';
          break;
        case 'TK_TAG_SINGLE':
          // Don't add a newline before elements that should remain unformatted.
          var tag_check = token.text.match(/^\s*<([a-z-]+)/i);
          if (token.tag_name === '!--' && multi_parser.last_token.is_closing_tag && token.text.indexOf('\n') === -1) {
            //Do nothing. Leave comments on same line.
          } else if (!tag_check ||
            !multi_parser.Utils.in_array(tag_check[1], inline_tags) &&
            !multi_parser.Utils.in_array(tag_check[1], unformatted)
          ) {
            multi_parser.print_newline(false, multi_parser.output);
          }
          multi_parser.print_token(token.text);
          last_tag_token = token;
          multi_parser.current_mode = 'CONTENT';
          break;
        case 'TK_TAG_HANDLEBARS_ELSE':
          // Don't add a newline if opening {{#if}} tag is on the current line
          var foundIfOnCurrentLine = false;
          for (var lastCheckedOutput = multi_parser.output.length - 1; lastCheckedOutput >= 0; lastCheckedOutput--) {
            if (multi_parser.output[lastCheckedOutput] === '\n') {
              break;
            } else {
              if (multi_parser.output[lastCheckedOutput].match(/{{#if/)) {
                foundIfOnCurrentLine = true;
                break;
              }
            }
          }
          if (!foundIfOnCurrentLine) {
            multi_parser.print_newline(false, multi_parser.output);
          }
          multi_parser.print_token(token.text);
          if (multi_parser.indent_content) {
            multi_parser.indent();
            multi_parser.indent_content = false;
          }
          multi_parser.current_mode = 'CONTENT';
          break;
        case 'TK_TAG_HANDLEBARS_COMMENT':
          multi_parser.print_token(token.text);
          multi_parser.current_mode = 'TAG';
          break;
        case 'TK_CONTENT':
          multi_parser.print_token(token.text);
          multi_parser.current_mode = 'TAG';
          if (!token.text) {
            continue;
          }
          break;
        case 'TK_STYLE':
        case 'TK_SCRIPT':
          if (token.text !== '') {
            multi_parser.print_newline(false, multi_parser.output);
            var text = token.text,
              _beautifier,
              script_indent_level = 1;
            if (token.type === 'TK_SCRIPT') {
              _beautifier = typeof js_beautify === 'function' && js_beautify;
            } else if (token.type === 'TK_STYLE') {
              _beautifier = typeof css_beautify === 'function' && css_beautify;
            }

            if (options.indent_scripts === "keep") {
              script_indent_level = 0;
            } else if (options.indent_scripts === "separate") {
              script_indent_level = -multi_parser.indent_level;
            }

            var indentation = multi_parser.get_full_indent(script_indent_level);
            if (_beautifier) {

              // call the Beautifier if avaliable
              var Child_options = function() {
                this.eol = '\n';
              };
              Child_options.prototype = options;
              var child_options = new Child_options();
              text = _beautifier(text.replace(/^\s*/, indentation), child_options);
            } else {
              // simply indent the string otherwise
              var white = text.match(/^\s*/)[0];
              var _level = white.match(/[^\n\r]*$/)[0].split(multi_parser.indent_string).length - 1;
              var reindent = multi_parser.get_full_indent(script_indent_level - _level);
              text = text.replace(/^\s*/, indentation)
                .replace(/\r\n|\r|\n/g, '\n' + reindent)
                .replace(/\s+$/, '');
            }
            if (text) {
              multi_parser.print_token_raw(text);
              multi_parser.print_newline(true, multi_parser.output);
            }
          }
          multi_parser.current_mode = 'TAG';
          break;
        default:
          // We should not be getting here but we don't want to drop input on the floor
          // Just output the text and move on
          if (token.text !== '') {
            multi_parser.print_token(token.text);
          }
          break;
      }
      multi_parser.last_token = token;

    }
    var sweet_code = multi_parser.output.join('').replace(/[\r\n\t ]+$/, '');

    // establish end_with_newline
    if (end_with_newline) {
      sweet_code += '\n';
    }

    if (eol !== '\n') {
      sweet_code = sweet_code.replace(/[\n]/g, eol);
    }

    return sweet_code;
  };
}

module.exports.Beautifier = Beautifier;