read_settings_from_cookie();

var default_text =
  "// This is just a sample script. Paste your real code (javascript or HTML) here.\n\nif ('this_is'==/an_example/){of_beautifier();}else{var a=b?(c%d):e[f];}";
var textArea = $('#source')[0];

$('#source').val(default_text).bind('click focus', function() {
  if ($(this).val() == default_text) {
    $(this).val('');
  }
}).bind('blur', function() {
  if (!$(this).val()) {
    $(this).val(default_text);
  }
});



$(window).bind('keydown', function(e) {
  if (e.ctrlKey && e.keyCode == 13) {
    beautify();
  }
})
$('.submit').click(beautify);
$('select').change(beautify);
$(':checkbox').change(beautify);
$('#additional-options').change(beautify);
