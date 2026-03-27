function R = Ry(theta)
% Rotation matrix about y-axis

    c = cos(theta);
    s = sin(theta);
    
    R = [ c  0  s;
          0  1  0;
         -s  0  c];
end

