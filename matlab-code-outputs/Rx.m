

function R = Rx(phi)
% Rotation matrix about x-axis

    c = cos(phi);
    s = sin(phi);
    
    R = [1  0  0;
         0  c -s;
         0  s  c];
end


