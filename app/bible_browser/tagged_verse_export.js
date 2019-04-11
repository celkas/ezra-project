/* This file is part of Ezra Project.

   Copyright (C) 2019 Tobias Klein <contact@ezra-project.net>

   Ezra Project is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.

   Ezra Project is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with Ezra Project. See the file COPYING.
   If not, see <http://www.gnu.org/licenses/>. */

const officegen = require('officegen')
const fs = require('fs')

class TaggedVerseExport {
  constructor() {
  }

  renderWordDocument(bibleBooks, groupedVerseTags, verses) {
    var docx = officegen('docx');

    // Officegen calling this function after finishing to generate the docx document:
    // docx.on('finalize', function(written) {});

    // Officegen calling this function to report errors:
    docx.on('error', function(err) {
      console.log(err)
    });

    var currentTagTitleList = bible_browser_controller.tab_controller.getCurrentTagTitleList();
    
    var p = docx.createP();
    p.addText("Bible verses tagged with: " + currentTagTitleList, { font_size: 14, bold: true });
    p.addLineBreak();
    p.addLineBreak();

    for (var i = 0; i < bibleBooks.length; i++) {
      var currentBook = bibleBooks[i];

      p.addText(currentBook.longTitle, { bold: true });
      p.addLineBreak();

      var lastVerseNr = 0;
      var allBlocks = [];
      var currentBlock = [];

      // Transform the list of verses into a list of verse blocks (verses that belong together)
      for (var j = 0; j < verses.length; j++) {
        var currentVerse = verses[j];

        if (currentVerse.bibleBookId == currentBook.id) {

          if (currentVerse.absoluteVerseNr > (lastVerseNr + 1)) {
            if (currentBlock.length > 0) {
              allBlocks.push(currentBlock);
            }
            currentBlock = [];
          }
          
          currentBlock.push(currentVerse);
          lastVerseNr = currentVerse.absoluteVerseNr;
        }
      }
      allBlocks.push(currentBlock);

      // Output the blocks into the document
      for (var j = 0; j < allBlocks.length; j++) {
        var currentBlock = allBlocks[j];

        var firstVerse = currentBlock[0];
        var lastVerse = currentBlock[currentBlock.length - 1];
        
        // Output the verse reference of this block
        p.addText(currentBook.longTitle);
        p.addText(" " + firstVerse.chapter + reference_separator + firstVerse.verseNr);

        if (currentBlock.length >= 2) { // At least 2 verses, a bigger block
          var secondRef = "";

          if (lastVerse.chapter == firstVerse.chapter) {
            secondRef = lastVerse.verseNr;
          } else {
            secondRef = lastVerse.chapter + reference_separator + lastVerse.verseNr;
          }

          p.addText("-" + secondRef);
        }
        p.addLineBreak();

        for (var k = 0; k < currentBlock.length; k++) {
          var currentVerse = currentBlock[k];
        
          p.addText(currentVerse.verseNr + "", { superscript: true });
          p.addText(" " + currentVerse.content);
          p.addLineBreak();
        }

        // Line break after block end
        p.addLineBreak();
      }

      // Line break after book end
      p.addLineBreak();
    }

    var out = fs.createWriteStream('example.docx');

    out.on('error', function(err) {
      console.log(err);
    });

    // Async call to generate the output file:
    docx.generate(out);
  }

  runExport() {
    var currentTagIdList = bible_browser_controller.tab_controller.getCurrentTagIdList();

    bible_browser_controller.communication_controller.request_verses_for_selected_tags(
      null,
      currentTagIdList,
      this.renderWordDocument,
      'docx',
      false
    );
  }
}

module.exports = TaggedVerseExport;