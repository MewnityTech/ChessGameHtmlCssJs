const board = document.getElementById('board');
const promotionModal = document.getElementById('promotion-modal');
const statusElement = document.querySelector('.status');
const movesTable = document.getElementById('moves');
const fileLabels = document.querySelector('.file-labels');
const rankLabels = document.querySelector('.rank-labels');

const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

let boardState = [];
let selectedSquare = null;
let validMoves = [];
let currentPlayer = 'w';
let gameActive = true;
let moveHistory = [];
let kingPositions = { w: '1e', b: '8e' };
let castlingRights = { wk: true, wq: true, bk: true, bq: true };
let enPassantTarget = null;
let halfMoveClock = 0;
let fullMoveNumber = 1;
let lastMove = null;
let inCheck = false;
let promotionCallback = null;

const pieces = {
  wp: '♙', wr: '♖', wn: '♘', wb: '♗', wq: '♕', wk: '♔',
  bp: '♟', br: '♜', bn: '♞', bb: '♝', bq: '♛', bk: '♚'
};

function createBoard() {
  boardState = [
    ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
    ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
    ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
  ];
  
  board.innerHTML = '';
  board.appendChild(promotionModal);
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const square = document.createElement('div');
      square.className = `square ${(rank + file) % 2 === 0 ? 'light' : 'dark'}`;
      square.dataset.file = file;
      square.dataset.rank = rank;
      square.addEventListener('click', handleSquareClick);
      
      const piece = boardState[rank][file];
      if (piece) {
        createPiece(square, piece);
      }
      
      board.appendChild(square);
    }
  }
  
  fileLabels.innerHTML = '';
  files.forEach(file => {
    const label = document.createElement('div');
    label.textContent = file;
    fileLabels.appendChild(label);
  });
  
  rankLabels.innerHTML = '';
  ranks.forEach(rank => {
    const label = document.createElement('div');
    label.textContent = rank;
    rankLabels.appendChild(label);
  });
}

function createPiece(square, piece) {
  const pieceElement = document.createElement('div');
  pieceElement.className = 'piece';
  pieceElement.textContent = pieces[piece];
  pieceElement.dataset.piece = piece;
  square.appendChild(pieceElement);
}

function handleSquareClick(event) {
  if (!gameActive) return;
  
  const square = event.currentTarget;
  const rank = parseInt(square.dataset.rank);
  const file = parseInt(square.dataset.file);
  
  if (selectedSquare) {
    const selectedRank = parseInt(selectedSquare.dataset.rank);
    const selectedFile = parseInt(selectedSquare.dataset.file);
    
    const moveFound = validMoves.find(move => 
      move.to.rank === rank && move.to.file === file
    );
    
    if (moveFound) {
      makeMove(selectedRank, selectedFile, rank, file, moveFound.promotion);
      clearSelection();
    } else if (square.querySelector(`.piece[data-piece^="${currentPlayer}"]`)) {
      clearSelection();
      selectSquare(square);
    } else {
      clearSelection();
    }
  } else if (square.querySelector(`.piece[data-piece^="${currentPlayer}"]`)) {
    selectSquare(square);
  }
}

function selectSquare(square) {
  selectedSquare = square;
  square.classList.add('selected');
  
  const rank = parseInt(square.dataset.rank);
  const file = parseInt(square.dataset.file);
  const piece = boardState[rank][file];
  
  validMoves = getValidMoves(rank, file, piece);
  
  validMoves.forEach(move => {
    const targetSquare = getSquareElement(move.to.rank, move.to.file);
    targetSquare.classList.add('valid-move');
  });
}

function clearSelection() {
  if (selectedSquare) {
    selectedSquare.classList.remove('selected');
    document.querySelectorAll('.valid-move').forEach(square => {
      square.classList.remove('valid-move');
    });
    selectedSquare = null;
    validMoves = [];
  }
}

function getValidMoves(rank, file, piece) {
  if (!piece) return [];
  
  const color = piece.charAt(0);
  const type = piece.charAt(1);
  let moves = [];
  
  const pieceMovesMap = {
    p: () => getPawnMoves(rank, file, color),
    r: () => getRookMoves(rank, file, color),
    n: () => getKnightMoves(rank, file, color),
    b: () => getBishopMoves(rank, file, color),
    q: () => getQueenMoves(rank, file, color),
    k: () => getKingMoves(rank, file, color)
  };
  
  if (pieceMovesMap[type]) {
    moves = pieceMovesMap[type]();
  }
  
  return moves.filter(move => !wouldBeInCheck(rank, file, move.to.rank, move.to.file, color));
}

function getPawnMoves(rank, file, color) {
  const moves = [];
  const direction = color === 'w' ? -1 : 1;
  const startRank = color === 'w' ? 6 : 1;
  
  const addPawnMove = (r, f, isCapture = false, isEnPassant = false) => {
    if (r < 0 || r > 7 || f < 0 || f > 7) return false;
    
    if (!isCapture && !isEnPassant && !boardState[r][f]) {
      if (r === 0 || r === 7) {
        moves.push({ to: { rank: r, file: f }, promotion: 'q' });
        moves.push({ to: { rank: r, file: f }, promotion: 'r' });
        moves.push({ to: { rank: r, file: f }, promotion: 'b' });
        moves.push({ to: { rank: r, file: f }, promotion: 'n' });
      } else {
        moves.push({ to: { rank: r, file: f } });
      }
      return true;
    } else if (isCapture && !isEnPassant) {
      const targetPiece = boardState[r][f];
      if (targetPiece && targetPiece.charAt(0) !== color) {
        if (r === 0 || r === 7) {
          moves.push({ to: { rank: r, file: f }, promotion: 'q' });
          moves.push({ to: { rank: r, file: f }, promotion: 'r' });
          moves.push({ to: { rank: r, file: f }, promotion: 'b' });
          moves.push({ to: { rank: r, file: f }, promotion: 'n' });
        } else {
          moves.push({ to: { rank: r, file: f } });
        }
        return false;
      }
    } else if (isEnPassant) {
      const epSquare = `${8 - r}${files[f]}`;
      if (epSquare === enPassantTarget) {
        moves.push({ to: { rank: r, file: f }, enPassant: true });
        return false;
      }
    }
    return false;
  };
  
  const oneAhead = addPawnMove(rank + direction, file);
  
  if (oneAhead && rank === startRank) {
    addPawnMove(rank + 2 * direction, file);
  }
  
  addPawnMove(rank + direction, file - 1, true);
  addPawnMove(rank + direction, file + 1, true);
  
  addPawnMove(rank + direction, file - 1, false, true);
  addPawnMove(rank + direction, file + 1, false, true);
  
  return moves;
}

function getRookMoves(rank, file, color) {
  const moves = [];
  
  const addRookMove = (r, f) => {
    if (r < 0 || r > 7 || f < 0 || f > 7) return false;
    
    const targetPiece = boardState[r][f];
    if (!targetPiece) {
      moves.push({ to: { rank: r, file: f } });
      return true;
    } else if (targetPiece.charAt(0) !== color) {
      moves.push({ to: { rank: r, file: f } });
      return false;
    }
    return false;
  };
  
  for (let r = rank + 1; r < 8; r++) if (!addRookMove(r, file)) break;
  for (let r = rank - 1; r >= 0; r--) if (!addRookMove(r, file)) break;
  for (let f = file + 1; f < 8; f++) if (!addRookMove(rank, f)) break;
  for (let f = file - 1; f >= 0; f--) if (!addRookMove(rank, f)) break;
  
  return moves;
}

function getKnightMoves(rank, file, color) {
  const moves = [];
  
  const knightOffsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  
  knightOffsets.forEach(([rankOffset, fileOffset]) => {
    const r = rank + rankOffset;
    const f = file + fileOffset;
    
    if (r >= 0 && r < 8 && f >= 0 && f < 8) {
      const targetPiece = boardState[r][f];
      if (!targetPiece || targetPiece.charAt(0) !== color) {
        moves.push({ to: { rank: r, file: f } });
      }
    }
  });
  
  return moves;
}

function getBishopMoves(rank, file, color) {
  const moves = [];
  
  const addBishopMove = (r, f) => {
    if (r < 0 || r > 7 || f < 0 || f > 7) return false;
    
    const targetPiece = boardState[r][f];
    if (!targetPiece) {
      moves.push({ to: { rank: r, file: f } });
      return true;
    } else if (targetPiece.charAt(0) !== color) {
      moves.push({ to: { rank: r, file: f } });
      return false;
    }
    return false;
  };
  
  for (let i = 1; i < 8; i++) if (!addBishopMove(rank + i, file + i)) break;
  for (let i = 1; i < 8; i++) if (!addBishopMove(rank + i, file - i)) break;
  for (let i = 1; i < 8; i++) if (!addBishopMove(rank - i, file + i)) break;
  for (let i = 1; i < 8; i++) if (!addBishopMove(rank - i, file - i)) break;
  
  return moves;
}

function getQueenMoves(rank, file, color) {
  return [...getRookMoves(rank, file, color), ...getBishopMoves(rank, file, color)];
}

function getKingMoves(rank, file, color) {
  const moves = [];
  
  const kingOffsets = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];
  
  kingOffsets.forEach(([rankOffset, fileOffset]) => {
    const r = rank + rankOffset;
    const f = file + fileOffset;
    
    if (r >= 0 && r < 8 && f >= 0 && f < 8) {
      const targetPiece = boardState[r][f];
      if (!targetPiece || targetPiece.charAt(0) !== color) {
        moves.push({ to: { rank: r, file: f } });
      }
    }
  });
  
  const canCastleKingside = color === 'w' ? castlingRights.wk : castlingRights.bk;
  const canCastleQueenside = color === 'w' ? castlingRights.wq : castlingRights.bq;
  const backRank = color === 'w' ? 7 : 0;
  
  if (canCastleKingside && !inCheck) {
    if (!boardState[backRank][5] && !boardState[backRank][6]) {
      if (!isSquareAttacked(backRank, 5, color) && !isSquareAttacked(backRank, 6, color)) {
        moves.push({ to: { rank: backRank, file: 6 }, castling: 'kingside' });
      }
    }
  }
  
  if (canCastleQueenside && !inCheck) {
    if (!boardState[backRank][1] && !boardState[backRank][2] && !boardState[backRank][3]) {
      if (!isSquareAttacked(backRank, 2, color) && !isSquareAttacked(backRank, 3, color)) {
        moves.push({ to: { rank: backRank, file: 2 }, castling: 'queenside' });
      }
    }
  }
  
  return moves;
}

function makeMove(fromRank, fromFile, toRank, toFile, promotion) {
  const piece = boardState[fromRank][fromFile];
  if (!piece) return false;
  
  const capturedPiece = boardState[toRank][toFile];
  const color = piece.charAt(0);
  const pieceType = piece.charAt(1);
  
  const moveData = {
    from: { rank: fromRank, file: fromFile },
    to: { rank: toRank, file: toFile },
    piece,
    captured: capturedPiece,
    prevEnPassantTarget: enPassantTarget,
    prevCastlingRights: {...castlingRights},
    prevHalfMoveClock: halfMoveClock,
    algebraic: generateAlgebraicNotation(fromRank, fromFile, toRank, toFile, piece, capturedPiece, promotion)
  };
  
  if (pieceType === 'p' && !capturedPiece && fromFile !== toFile) {
    const enPassantRank = color === 'w' ? toRank + 1 : toRank - 1;
    moveData.enPassantCapture = boardState[enPassantRank][toFile];
    boardState[enPassantRank][toFile] = null;
    
    const captureSquare = getSquareElement(enPassantRank, toFile);
    if (captureSquare.firstChild) {
      captureSquare.removeChild(captureSquare.firstChild);
    }
  }
  
  if (pieceType === 'p' && Math.abs(fromRank - toRank) === 2) {
    const direction = color === 'w' ? -1 : 1;
    const enPassantRank = fromRank + direction;
    enPassantTarget = `${8 - enPassantRank}${files[toFile]}`;
  } else {
    enPassantTarget = null;
  }
  
  if (pieceType === 'k') {
    kingPositions[color] = `${8 - toRank}${files[toFile]}`;
    
    if (Math.abs(fromFile - toFile) > 1) {
      const isKingside = toFile > fromFile;
      const rookFile = isKingside ? 7 : 0;
      const newRookFile = isKingside ? 5 : 3;
      
      const rookPiece = boardState[fromRank][rookFile];
      
      moveData.castling = isKingside ? 'kingside' : 'queenside';
      moveData.rookFrom = { rank: fromRank, file: rookFile };
      moveData.rookTo = { rank: fromRank, file: newRookFile };
      moveData.rookPiece = rookPiece;
      
      boardState[fromRank][newRookFile] = rookPiece;
      boardState[fromRank][rookFile] = null;
      
      const rookFromSquare = getSquareElement(fromRank, rookFile);
      const rookToSquare = getSquareElement(fromRank, newRookFile);
      
      if (rookFromSquare.firstChild) {
        rookToSquare.appendChild(rookFromSquare.firstChild);
      }
    }
    
    if (color === 'w') {
      castlingRights.wk = false;
      castlingRights.wq = false;
    } else {
      castlingRights.bk = false;
      castlingRights.bq = false;
    }
  }
  
  if (pieceType === 'r') {
    if (fromRank === 7 && fromFile === 0) castlingRights.wq = false;
    if (fromRank === 7 && fromFile === 7) castlingRights.wk = false;
    if (fromRank === 0 && fromFile === 0) castlingRights.bq = false;
    if (fromRank === 0 && fromFile === 7) castlingRights.bk = false;
  }
  
  if (capturedPiece) {
    if (capturedPiece === 'wr' && toRank === 7 && toFile === 0) castlingRights.wq = false;
    if (capturedPiece === 'wr' && toRank === 7 && toFile === 7) castlingRights.wk = false;
    if (capturedPiece === 'br' && toRank === 0 && toFile === 0) castlingRights.bq = false;
    if (capturedPiece === 'br' && toRank === 0 && toFile === 7) castlingRights.bk = false;
  }
  
  if (pieceType === 'p' && (toRank === 0 || toRank === 7) && promotion) {
    if (promotion === 'q' || promotion === 'r' || promotion === 'b' || promotion === 'n') {
      moveData.promotion = promotion;
      boardState[toRank][toFile] = color + promotion;
    } else {
      showPromotionOptions(fromRank, fromFile, toRank, toFile, color, moveData);
      return;
    }
  } else {
    boardState[toRank][toFile] = piece;
  }
  
  boardState[fromRank][fromFile] = null;
  
  if (pieceType === 'p' || capturedPiece) {
    halfMoveClock = 0;
  } else {
    halfMoveClock++;
  }
  
  if (color === 'b') {
    fullMoveNumber++;
  }
  
  const fromSquare = getSquareElement(fromRank, fromFile);
  const toSquare = getSquareElement(toRank, toFile);
  
  if (toSquare.firstChild) {
    toSquare.removeChild(toSquare.firstChild);
  }
  
  if (fromSquare.firstChild) {
    toSquare.appendChild(fromSquare.firstChild);
    
    if (moveData.promotion) {
      toSquare.firstChild.textContent = pieces[color + moveData.promotion];
      toSquare.firstChild.dataset.piece = color + moveData.promotion;
    }
  }
  
  moveHistory.push(moveData);
  updateMoveTable(moveData);
  
  if (lastMove) {
    const lastMoveFromSquare = getSquareElement(lastMove.from.rank, lastMove.from.file);
    const lastMoveToSquare = getSquareElement(lastMove.to.rank, lastMove.to.file);
    
    lastMoveFromSquare.classList.remove('last-move');
    lastMoveToSquare.classList.remove('last-move');
  }
  
  fromSquare.classList.add('last-move');
  toSquare.classList.add('last-move');
  lastMove = { from: { rank: fromRank, file: fromFile }, to: { rank: toRank, file: toFile } };
  
  document.querySelectorAll('.check').forEach(square => {
    square.classList.remove('check');
  });
  
  currentPlayer = currentPlayer === 'w' ? 'b' : 'w';
  
  const opponentColor = currentPlayer;
  const kingPos = kingPositions[opponentColor];
  const kingRank = 8 - parseInt(kingPos.charAt(0));
  const kingFile = files.indexOf(kingPos.charAt(1));
  
  inCheck = isSquareAttacked(kingRank, kingFile, opponentColor);
  
  if (inCheck) {
    const kingSquare = getSquareElement(kingRank, kingFile);
    kingSquare.classList.add('check');
  }
  
  const gameStatus = getGameStatus();
  updateStatus(gameStatus);
  
  return true;
}

function showPromotionOptions(fromRank, fromFile, toRank, toFile, color, moveData) {
  const promotionPieces = ['q', 'r', 'b', 'n'];
  
  promotionModal.innerHTML = '';
  promotionModal.style.display = 'flex';
  
  const toSquare = getSquareElement(toRank, toFile);
  const toSquareRect = toSquare.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();
  
  let top = toSquareRect.top - boardRect.top;
  
  if (color === 'w') {
    promotionModal.style.top = `${top}px`;
  } else {
    promotionModal.style.top = `${top - 180}px`;
  }
  
  promotionModal.style.left = `${toSquareRect.left - boardRect.left}px`;
  
  promotionPieces.forEach(pieceType => {
    const option = document.createElement('div');
    option.className = 'promotion-option';
    option.textContent = pieces[color + pieceType];
    option.addEventListener('click', () => {
      promotionModal.style.display = 'none';
      
      moveData.promotion = pieceType;
      boardState[toRank][toFile] = color + pieceType;
      
      if (color === 'w') {
        boardState[fromRank][fromFile] = null;
      }
      
      moveHistory.push(moveData);
      updateMoveTable(moveData);
      
      const fromSquare = getSquareElement(fromRank, fromFile);
      
      if (fromSquare.firstChild) {
        toSquare.appendChild(fromSquare.firstChild);
        toSquare.firstChild.textContent = pieces[color + pieceType];
        toSquare.firstChild.dataset.piece = color + pieceType;
      }
      
      if (lastMove) {
        const lastMoveFromSquare = getSquareElement(lastMove.from.rank, lastMove.from.file);
        const lastMoveToSquare = getSquareElement(lastMove.to.rank, lastMove.to.file);
        
        lastMoveFromSquare.classList.remove('last-move');
        lastMoveToSquare.classList.remove('last-move');
      }
      
      fromSquare.classList.add('last-move');
      toSquare.classList.add('last-move');
      lastMove = { from: { rank: fromRank, file: fromFile }, to: { rank: toRank, file: toFile } };
      
      document.querySelectorAll('.check').forEach(square => {
        square.classList.remove('check');
      });
      
      currentPlayer = currentPlayer === 'w' ? 'b' : 'w';
      
      const opponentColor = currentPlayer;
      const kingPos = kingPositions[opponentColor];
      const kingRank = 8 - parseInt(kingPos.charAt(0));
      const kingFile = files.indexOf(kingPos.charAt(1));
      
      inCheck = isSquareAttacked(kingRank, kingFile, opponentColor);
      
      if (inCheck) {
        const kingSquare = getSquareElement(kingRank, kingFile);
        kingSquare.classList.add('check');
      }
      
      const gameStatus = getGameStatus();
      updateStatus(gameStatus);
    });
    
    promotionModal.appendChild(option);
  });
}

function generateAlgebraicNotation(fromRank, fromFile, toRank, toFile, piece, capturedPiece, promotion) {
  const pieceType = piece.charAt(1);
  const pieceSymbol = pieceType === 'p' ? '' : pieceType.toUpperCase();
  
  const fromSquare = `${files[fromFile]}${8 - fromRank}`;
  const toSquare = `${files[toFile]}${8 - toRank}`;
  
  let moveText = '';
  
  if (pieceType === 'k' && Math.abs(fromFile - toFile) > 1) {
    moveText = toFile > fromFile ? 'O-O' : 'O-O-O';
  } else {
    moveText = `${pieceSymbol}${fromSquare}${capturedPiece ? 'x' : ''}${toSquare}`;
    
    if (promotion) {
      moveText += `=${promotion.toUpperCase()}`;
    }
  }
  
  return moveText;
}

function wouldBeInCheck(fromRank, fromFile, toRank, toFile, color) {
  const tempBoardState = boardState.map(rank => [...rank]);
  const piece = tempBoardState[fromRank][fromFile];
  
  tempBoardState[toRank][toFile] = piece;
  tempBoardState[fromRank][fromFile] = null;
  
  if (piece.charAt(1) === 'k') {
    const kingPos = `${8 - toRank}${files[toFile]}`;
    const kingRank = toRank;
    const kingFile = toFile;
    
    return isSquareAttackedByBoard(kingRank, kingFile, color, tempBoardState);
  } else {
    const kingPos = kingPositions[color];
    const kingRank = 8 - parseInt(kingPos.charAt(0));
    const kingFile = files.indexOf(kingPos.charAt(1));
    
    return isSquareAttackedByBoard(kingRank, kingFile, color, tempBoardState);
  }
}

function isSquareAttacked(rank, file, color) {
  return isSquareAttackedByBoard(rank, file, color, boardState);
}

function isSquareAttackedByBoard(rank, file, color, board) {
  const opponentColor = color === 'w' ? 'b' : 'w';
  
  const directions = [
    [-1, 0], [1, 0], [0, -1], [0, 1],  // ладья король
    [-1, -1], [-1, 1], [1, -1], [1, 1]  //слон ферзь
  ];
  
  const knightOffsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1]
  ];
  
  const kingOffsets = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];
  
  const pawnOffsets = color === 'w' ? [[1, -1], [1, 1]] : [[-1, -1], [-1, 1]];
  
  for (const [rankOffset, fileOffset] of pawnOffsets) {
    const r = rank + rankOffset;
    const f = file + fileOffset;
    
    if (r >= 0 && r < 8 && f >= 0 && f < 8) {
      const piece = board[r][f];
      if (piece === `${opponentColor}p`) {
        return true;
      }
    }
  }
  
  for (const [rankOffset, fileOffset] of knightOffsets) {
    const r = rank + rankOffset;
    const f = file + fileOffset;
    
    if (r >= 0 && r < 8 && f >= 0 && f < 8) {
      const piece = board[r][f];
      if (piece === `${opponentColor}n`) {
        return true;
      }
    }
  }
  
  for (const [rankOffset, fileOffset] of kingOffsets) {
    const r = rank + rankOffset;
    const f = file + fileOffset;
    
    if (r >= 0 && r < 8 && f >= 0 && f < 8) {
      const piece = board[r][f];
      if (piece === `${opponentColor}k`) {
        return true;
      }
    }
  }
  
  for (let i = 0; i < directions.length; i++) {
    const [rankDirection, fileDirection] = directions[i];
    let r = rank + rankDirection;
    let f = file + fileDirection;
    
    while (r >= 0 && r < 8 && f >= 0 && f < 8) {
      const piece = board[r][f];
      
      if (piece) {
        if (piece.charAt(0) === opponentColor) {
          const pieceType = piece.charAt(1);
          
          if (pieceType === 'q' || 
              (pieceType === 'r' && i < 4) || 
              (pieceType === 'b' && i >= 4)) {
            return true;
          }
        }
        break;
      }
      
      r += rankDirection;
      f += fileDirection;
    }
  }
  
  return false;
}

function getGameStatus() {
  const possibleMoves = getAllPossibleMoves(currentPlayer);
  
  if (possibleMoves.length === 0) {
    if (inCheck) {
      return currentPlayer === 'w' ? 'Checkmate! Black wins' : 'Checkmate! White wins';
    } else {
      return 'Stalemate! Draw';
    }
  }
  
  if (halfMoveClock >= 50) {
    return 'Draw by 50-move rule';
  }
  
  if (inCheck) {
    return currentPlayer === 'w' ? 'White is in check' : 'Black is in check';
  }
  
  return currentPlayer === 'w' ? 'White to move' : 'Black to move';
}

function getAllPossibleMoves(color) {
  let allMoves = [];
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = boardState[rank][file];
      
      if (piece && piece.charAt(0) === color) {
        const pieceMoves = getValidMoves(rank, file, piece);
        allMoves = allMoves.concat(pieceMoves.map(move => ({
          from: { rank, file },
          to: move.to,
          piece
        })));
      }
    }
  }
  
  return allMoves;
}

function getSquareElement(rank, file) {
  return document.querySelector(`.square[data-rank="${rank}"][data-file="${file}"]`);
}

function updateStatus(status) {
  statusElement.textContent = status;
  
  if (status.includes('Checkmate') || status.includes('Stalemate') || status.includes('Draw')) {
    gameActive = false;
  }
}

function updateMoveTable(move) {
  if (moveHistory.length % 2 === 1) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${Math.floor((moveHistory.length + 1) / 2)}</td>
      <td>${move.algebraic}</td>
      <td></td>
    `;
    movesTable.appendChild(row);
  } else {
    const lastRow = movesTable.lastElementChild;
    if (lastRow) {
      const lastCell = lastRow.lastElementChild;
      lastCell.textContent = move.algebraic;
    }
  }
}

function undoMove() {
  if (moveHistory.length === 0) return;
  
  const lastMove = moveHistory.pop();
  const { from, to, piece, captured, prevEnPassantTarget, prevCastlingRights, prevHalfMoveClock, castling, rookFrom, rookTo, rookPiece, enPassantCapture, promotion } = lastMove;
  
  boardState[from.rank][from.file] = piece;
  boardState[to.rank][to.file] = captured;
  
  if (piece.charAt(1) === 'k') {
    kingPositions[piece.charAt(0)] = `${8 - from.rank}${files[from.file]}`;
  }
  
  if (enPassantCapture) {
    const enPassantRank = piece.charAt(0) === 'w' ? to.rank + 1 : to.rank - 1;
    boardState[enPassantRank][to.file] = enPassantCapture;
  }
  
  if (castling) {
    boardState[rookTo.rank][rookTo.file] = null;
    boardState[rookFrom.rank][rookFrom.file] = rookPiece;
  }
  
  enPassantTarget = prevEnPassantTarget;
  castlingRights = prevCastlingRights;
  halfMoveClock = prevHalfMoveClock;
  
  if (piece.charAt(0) === 'b') {
    fullMoveNumber--;
  }
  
  currentPlayer = currentPlayer === 'w' ? 'b' : 'w';
  
  renderBoard();
  
  const movesRows = movesTable.querySelectorAll('tr');
  if (moveHistory.length % 2 === 0 && movesRows.length > 0) {
    const lastRow = movesRows[movesRows.length - 1];
    lastRow.querySelector('td:last-child').textContent = '';
    
    if (moveHistory.length === 0) {
      movesTable.removeChild(lastRow);
    }
  } else if (moveHistory.length % 2 === 1 && movesRows.length > 0) {
    movesTable.removeChild(movesRows[movesRows.length - 1]);
  }
  
  document.querySelectorAll('.check').forEach(square => {
    square.classList.remove('check');
  });
  
  if (moveHistory.length > 0) {
    const previousMove = moveHistory[moveHistory.length - 1];
    const prevFromSquare = getSquareElement(previousMove.from.rank, previousMove.from.file);
    const prevToSquare = getSquareElement(previousMove.to.rank, previousMove.to.file);
    
    prevFromSquare.classList.add('last-move');
    prevToSquare.classList.add('last-move');
    lastMove = { from: previousMove.from, to: previousMove.to };
  } else {
    lastMove = null;
  }
  
  const kingPos = kingPositions[currentPlayer];
  const kingRank = 8 - parseInt(kingPos.charAt(0));
  const kingFile = files.indexOf(kingPos.charAt(1));
  
  inCheck = isSquareAttacked(kingRank, kingFile, currentPlayer);
  
  if (inCheck) {
    const kingSquare = getSquareElement(kingRank, kingFile);
    kingSquare.classList.add('check');
  }
  
  const gameStatus = getGameStatus();
  updateStatus(gameStatus);
}

function renderBoard() {
  board.innerHTML = '';
  board.appendChild(promotionModal);
  
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const square = document.createElement('div');
      square.className = `square ${(rank + file) % 2 === 0 ? 'light' : 'dark'}`;
      square.dataset.file = file;
      square.dataset.rank = rank;
      square.addEventListener('click', handleSquareClick);
      
      const piece = boardState[rank][file];
      if (piece) {
        createPiece(square, piece);
      }
      
      if (lastMove && 
          ((lastMove.from.rank === rank && lastMove.from.file === file) || 
           (lastMove.to.rank === rank && lastMove.to.file === file))) {
        square.classList.add('last-move');
      }
      
      board.appendChild(square);
    }
  }
}

function restart() {
  boardState = [
    ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
    ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
    ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr']
  ];
  
  selectedSquare = null;
  validMoves = [];
  currentPlayer = 'w';
  gameActive = true;
  moveHistory = [];
  kingPositions = { w: '1e', b: '8e' };
  castlingRights = { wk: true, wq: true, bk: true, bq: true };
  enPassantTarget = null;
  halfMoveClock = 0;
  fullMoveNumber = 1;
  lastMove = null;
  inCheck = false;
  
  renderBoard();
  movesTable.innerHTML = '';
  updateStatus('White to move');
}

document.getElementById('restart').addEventListener('click', restart);
document.getElementById('undo').addEventListener('click', undoMove);

createBoard();
